import { createStep, createWorkflow } from "@mastra/core/workflows";
import { execFile } from "node:child_process";
import { open, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const TRUSTED_GATE_REVISION = "49dd4eebc4178a8f221f915033ce8d345668737e";
const APPROVED_BASE_SHA = "0d80328e3c6aa053817a5679af3f3d5cb2c5e717";
const JOB_ID = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const SHA = z.string().regex(/^[0-9a-f]{40}$/i);
const JobSchema = z.object({
  id: JOB_ID,
  repository: z.literal("gabchess/agent-factory"),
  baseSha: SHA,
  paths: z.array(z.string().min(1)).min(1),
});
const WorkerResultSchema = z.object({
  candidateSha: SHA,
  summary: z.string().min(1),
  report: z.string().min(1).refine(
    (report) => /\bSimulation evidence\b/i.test(report),
    "Worker report must label simulation evidence",
  ),
  ask: z.string().optional(),
});
const ReviewResultSchema = z.object({
  verdict: z.enum(["pass", "fail", "unknown"]),
  reviewedSha: SHA,
  findings: z.array(z.string()),
});
const GateRowSchema = z.object({
  at: z.string(),
  run: z.string(),
  task: z.string(),
  attempt: z.number(),
  loop_cap: z.number(),
  verdict: z.enum(["pass", "fail"]),
  status: z.enum(["passed", "failed", "blocked"]),
  reason: z.string(),
  missing: z.array(z.string()),
  unlisted: z.array(z.string()),
  ask: z.string(),
  dry_run: z.boolean(),
});

type Job = z.infer<typeof JobSchema>;
type WorkerResult = z.infer<typeof WorkerResultSchema>;
type ReviewResult = z.infer<typeof ReviewResultSchema>;
type GateRow = z.infer<typeof GateRowSchema>;

export type WorkshopAdapters = {
  worker: (job: Job) => Promise<WorkerResult>;
  reviewer: (input: { job: Job; worker: WorkerResult }) => Promise<ReviewResult>;
};

export type RunWorkshopJobInput = {
  job: Job;
  stateDirectory: string;
  briefPath: string;
  gatePath: string;
  gateRevision: string;
  worker: WorkshopAdapters["worker"];
  reviewer: WorkshopAdapters["reviewer"];
};

const InputSchema = z.object({
  job: JobSchema,
  executionId: z.string(),
  stateDirectory: z.string(),
  briefPath: z.string(),
  gatePath: z.string(),
  gateRevision: z.string(),
});
const WorkerStepOutputSchema = InputSchema.extend({ worker: WorkerResultSchema });
const ReviewStepOutputSchema = WorkerStepOutputSchema.extend({ review: ReviewResultSchema });
const OutputSchema = ReviewStepOutputSchema.extend({
  decision: z.enum(["passed", "retry", "blocked"]),
  gateRow: GateRowSchema,
});

const exactPaths = new Set([
  ".gitignore",
  "README.md",
  "package.json",
  "package-lock.json",
  "test/workshop.test.js",
  "tsconfig.workshop.json",
  ".github/workflows/checks.yml",
]);

function validatePathScope(paths: string[]): void {
  for (const item of paths) {
    if (item.includes("\\") || item.startsWith("/") || item.split("/").includes("..")) {
      throw new Error(`Path is outside the approved scope: ${item}`);
    }
    if (
      !exactPaths.has(item) &&
      !item.startsWith("workshop/") &&
      !item.startsWith("test/workshop/")
    ) {
      throw new Error(`Path is outside the approved scope: ${item}`);
    }
  }
}

async function verifyTrustedGate(gatePath: string, gateRevision: string): Promise<void> {
  if (gateRevision !== TRUSTED_GATE_REVISION) {
    throw new Error(`Gate revision must be ${TRUSTED_GATE_REVISION}`);
  }
  const { stdout: rootOutput } = await execFileAsync("git", [
    "-C",
    path.dirname(gatePath),
    "rev-parse",
    "--show-toplevel",
  ]);
  const repositoryRoot = rootOutput.trim();
  const relativeGatePath = path.relative(repositoryRoot, gatePath).split(path.sep).join("/");
  const expectedPath = "skills/orchestration/orchestrate-task/scripts/gate.mjs";
  if (relativeGatePath !== expectedPath) {
    throw new Error(`Gate path must be ${expectedPath} in the pinned skills checkout`);
  }
  const { stdout: revisionOutput } = await execFileAsync("git", [
    "-C",
    repositoryRoot,
    "rev-parse",
    "HEAD",
  ]);
  if (revisionOutput.trim() !== TRUSTED_GATE_REVISION) {
    throw new Error(`Gate checkout must be at ${TRUSTED_GATE_REVISION}`);
  }
  const { stdout: committedSource } = await execFileAsync("git", [
    "-C",
    repositoryRoot,
    "show",
    `${TRUSTED_GATE_REVISION}:${expectedPath}`,
  ]);
  if (committedSource !== await readFile(gatePath, "utf8")) {
    throw new Error("Gate CLI differs from its pinned Git source");
  }
}

async function runGate(input: z.infer<typeof ReviewStepOutputSchema>): Promise<{
  decision: "passed" | "retry" | "blocked";
  gateRow: GateRow;
}> {
  const recordPath = path.join(input.stateDirectory, "gate-runs.jsonl");
  const reportPath = path.join(input.stateDirectory, `${input.executionId}.report.md`);
  await writeFile(reportPath, input.worker.report, { flag: "wx" });
  const exactReview = input.review.reviewedSha === input.worker.candidateSha;
  const reviewPassed = input.review.verdict === "pass" && exactReview;
  const reason =
    input.review.verdict === "unknown"
      ? "independent reviewer returned an unknown verdict"
      : !exactReview
        ? "reviewed SHA does not match the candidate SHA"
        : input.review.findings.join("; ") || "independent reviewer rejected the candidate";
  const args = [
    input.gatePath,
    "--run",
    input.executionId,
    "--brief",
    input.briefPath,
    "--report",
    reportPath,
    "--record",
    recordPath,
    "--verdict",
    reviewPassed ? "pass" : "fail",
    "--dry-run",
  ];
  if (!reviewPassed) args.push("--reason", reason);

  let stdout = "";
  let stderr = "";
  let exitCode: number | null = null;
  let processError: { code: string | number | null; message: string } | null = null;
  let executionError: unknown;
  try {
    const result = await execFileAsync(process.execPath, args, { maxBuffer: 1024 * 1024 });
    stdout = result.stdout;
    stderr = result.stderr;
    exitCode = 0;
  } catch (error) {
    const failure = error as {
      stdout?: string; stderr?: string; code?: string | number; message?: string;
    };
    stdout = typeof failure.stdout === "string" ? failure.stdout : "";
    stderr = typeof failure.stderr === "string" ? failure.stderr : "";
    exitCode = typeof failure.code === "number" ? failure.code : null;
    processError = {
      code: failure.code ?? null,
      message: failure.message ?? String(error),
    };
    executionError = error;
  }
  await writeFile(
    path.join(input.stateDirectory, `${input.executionId}.gate-process.json`),
    JSON.stringify({ executionId: input.executionId, stdout, stderr, exitCode, processError }) + "\n",
    { flag: "wx" },
  );
  if (executionError && exitCode !== 2 && exitCode !== 3) throw executionError;
  const row = GateRowSchema.parse(JSON.parse(stdout.trim()));
  if ((row.status === "passed" && exitCode !== 0) ||
      (row.status === "failed" && exitCode !== 2) ||
      (row.status === "blocked" && exitCode !== 3)) {
    throw new Error("Gate exit code did not match its recorded decision");
  }
  return {
    decision: row.status === "passed" ? "passed" : row.status === "failed" ? "retry" : "blocked",
    gateRow: row,
  };
}

function makeWorkflow(adapters: WorkshopAdapters) {
  const workerStep = createStep({
    id: "controlled-worker",
    inputSchema: InputSchema,
    outputSchema: WorkerStepOutputSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      worker: WorkerResultSchema.parse(await adapters.worker(inputData.job)),
    }),
  });
  const reviewerStep = createStep({
    id: "independent-reviewer",
    inputSchema: WorkerStepOutputSchema,
    outputSchema: ReviewStepOutputSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      review: ReviewResultSchema.parse(
        await adapters.reviewer({ job: inputData.job, worker: inputData.worker }),
      ),
    }),
  });
  const gateStep = createStep({
    id: "existing-gate",
    inputSchema: ReviewStepOutputSchema,
    outputSchema: OutputSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      ...(await runGate(inputData)),
    }),
  });
  return createWorkflow({
    id: "simulated-workshop-job",
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  })
    .then(workerStep)
    .then(reviewerStep)
    .then(gateStep)
    .commit();
}

export async function runWorkshopJob(input: RunWorkshopJobInput) {
  const job = JobSchema.parse(input.job);
  if (job.baseSha !== APPROVED_BASE_SHA) {
    throw new Error("base SHA is not the approved checkout");
  }
  validatePathScope(job.paths);
  if ((input.worker as unknown) === input.reviewer) {
    throw new Error("Worker and reviewer must be distinct adapters");
  }
  if (!input.stateDirectory || !input.briefPath || !input.gatePath) {
    throw new Error("A state directory, lane brief and trusted gate path are required");
  }
  await verifyTrustedGate(input.gatePath, input.gateRevision);

  const stateDirectory = path.resolve(input.stateDirectory);
  await mkdir(stateDirectory, { recursive: true });
  const executionId = `dry-run-${job.id}`;
  const lockPath = path.join(stateDirectory, "active.lock");
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("Another workshop job is active in this state directory");
    }
    throw error;
  }

  const executionPath = path.join(stateDirectory, `${executionId}.json`);
  let identityCreated = false;
  try {
    const record = {
      executionId,
      dryRun: true,
      status: "running",
      job,
      gateRevision: input.gateRevision,
    };
    const identity = await open(executionPath, "wx");
    identityCreated = true;
    await identity.writeFile(`${JSON.stringify(record)}\n`);
    await identity.close();

    const workflow = makeWorkflow({ worker: input.worker, reviewer: input.reviewer });
    const run = await workflow.createRun({ runId: executionId });
    const result = await run.start({
      inputData: {
        job,
        executionId,
        stateDirectory,
        briefPath: input.briefPath,
        gatePath: input.gatePath,
        gateRevision: input.gateRevision,
      },
    });
    if (result.status !== "success") {
      throw new Error(`Mastra workflow ended with status ${result.status}`);
    }
    await writeFile(executionPath, `${JSON.stringify({
      ...record,
      status: result.result.decision,
      gateRow: result.result.gateRow,
    })}\n`);
    return {
      executionId,
      dryRun: true as const,
      decision: result.result.decision,
      gateRow: result.result.gateRow,
      worker: result.result.worker,
      review: result.result.review,
    };
  } catch (error) {
    if (identityCreated) {
      try {
        const previous = JSON.parse(await readFile(executionPath, "utf8"));
        await writeFile(executionPath, `${JSON.stringify({
          ...previous,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        })}\n`);
      } catch {
        // Keep the original execution error.
      }
    }
    throw error;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
