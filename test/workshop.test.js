import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runWorkshopJob } from "../workshop/index.ts";

const baseSha = "0d80328e3c6aa053817a5679af3f3d5cb2c5e717";
const gatePath = [
  path.resolve("skills-checkout/skills/orchestration/orchestrate-task/scripts/gate.mjs"),
  "/tmp/workshop-skills/skills/orchestration/orchestrate-task/scripts/gate.mjs",
].find(existsSync);
if (!gatePath) throw new Error("Check out the pinned skills revision for workshop tests.");
const gateRevision = "49dd4eebc4178a8f221f915033ce8d345668737e";

async function createTestDirectory(prefix) {
  const stateDirectory = await mkdtemp(path.join(os.tmpdir(), prefix));
  const briefPath = path.join(stateDirectory, "lane-brief.md");
  await writeFile(
    briefPath,
    [
      "# Lane brief: Route one simulated job through Mastra and the existing gate",
      "",
      "## Skills and tools",
      "",
      "- Load: `implement`",
      "- Load: `tdd`",
      "- Load: `codebase-design`",
      "- Load: `mastra`",
      "- Load: `gabe-voice`",
      "- Load: `package-management`",
      "- Use: `ReadFile`",
      "- Use: `ShellExec`",
      "- Use: `apply_patch`",
      "",
      "## Limits",
      "",
      "- Loop cap: 3 attempts.",
      "- Stop when: a provider call is needed.",
      "",
    ].join("\n"),
  );
  return { stateDirectory, briefPath };
}

function simulatedWorkerReport(result, ask = "None.") {
  return [
    "# Worker report: Route one simulated job through Mastra and the existing gate",
    "",
    "## Result",
    "",
    `PARTIAL: Simulation evidence from a controlled worker adapter fixture. ${result}`,
    "",
    "## Loaded",
    "",
    "- Load: `implement`",
    "- Load: `tdd`",
    "- Load: `codebase-design`",
    "- Load: `mastra`",
    "- Load: `gabe-voice`",
    "- Load: `package-management`",
    "- Use: `ReadFile`",
    "- Use: `ShellExec`",
    "- Use: `apply_patch`",
    "",
    "## Could not verify",
    "",
    "- The fixture does not verify live worker behavior.",
    "",
    "## Ask",
    "",
    ask,
    "",
  ].join("\n");
}

test("a scoped job returns the real gate pass with independent worker and reviewer results", async () => {
  const { stateDirectory, briefPath } = await createTestDirectory("workshop-pass-");
  const events = [];
  try {
    const result = await runWorkshopJob({
      job: {
        id: "passed-job",
        repository: "gabchess/agent-factory",
        baseSha,
        paths: ["workshop/"],
      },
      stateDirectory,
      briefPath,
      gatePath,
      gateRevision,
      worker: async (job) => {
        events.push("worker");
        const identity = JSON.parse(
          await readFile(path.join(stateDirectory, "dry-run-passed-job.json"), "utf8"),
        );
        assert.equal(identity.status, "running");
        return {
          candidateSha: job.baseSha,
          summary: "Implemented the approved workshop slice.",
          report: simulatedWorkerReport("The candidate adapter returns the scoped SHA."),
        };
      },
      reviewer: async ({ worker }) => {
        events.push("reviewer");
        return { verdict: "pass", reviewedSha: worker.candidateSha, findings: [] };
      },
    });

    assert.deepEqual(events, ["worker", "reviewer"]);
    assert.equal(result.decision, "passed");
    assert.equal(result.executionId, "dry-run-passed-job");
    assert.equal(result.gateRow.run, "dry-run-passed-job");
    assert.equal(result.gateRow.status, "passed");
    assert.equal(result.gateRow.dry_run, true);
    assert.equal(result.worker.candidateSha, baseSha);
    assert.equal(result.review.reviewedSha, baseSha);
    const execution = JSON.parse(
      await readFile(path.join(stateDirectory, "dry-run-passed-job.json"), "utf8"),
    );
    assert.equal(execution.status, "passed");
    assert.equal(execution.dryRun, true);
    const evidence = JSON.parse(
      await readFile(path.join(stateDirectory, "dry-run-passed-job.gate-process.json"), "utf8"),
    );
    assert.equal(evidence.exitCode, 0);
    assert.equal(evidence.stderr, "");
    assert.equal(evidence.processError, null);
    assert.equal(JSON.parse(evidence.stdout).status, "passed");
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("the gate sees missing worker report declarations instead of wrapper attestations", async () => {
  const { stateDirectory, briefPath } = await createTestDirectory("workshop-report-provenance-");
  const report = [
    "# Worker report: Route one simulated job through Mastra and the existing gate",
    "",
    "## Result",
    "",
    "PARTIAL: Simulation evidence from a controlled worker adapter fixture.",
    "",
    "## Loaded",
    "",
    "- Load: `tdd`",
    "- Load: `codebase-design`",
    "- Load: `mastra`",
    "- Load: `gabe-voice`",
    "- Load: `package-management`",
    "- Use: `ReadFile`",
    "- Use: `ShellExec`",
    "- Use: `apply_patch`",
    "",
    "## Could not verify",
    "",
    "- The controlled adapter did not supply an `implement` loading declaration.",
    "",
    "## Ask",
    "",
    "None.",
    "",
  ].join("\n");
  try {
    const result = await runWorkshopJob({
      job: {
        id: "report-provenance",
        repository: "gabchess/agent-factory",
        baseSha,
        paths: ["workshop/"],
      },
      stateDirectory,
      briefPath,
      gatePath,
      gateRevision,
      worker: async (job) => ({
        candidateSha: job.baseSha,
        summary: "Controlled worker fixture.",
        report,
      }),
      reviewer: async ({ worker }) => ({
        verdict: "pass",
        reviewedSha: worker.candidateSha,
        findings: [],
      }),
    });

    assert.equal(result.decision, "retry");
    assert.deepEqual(result.gateRow.missing, ["Load: implement"]);
    assert.equal(
      await readFile(path.join(stateDirectory, "dry-run-report-provenance.report.md"), "utf8"),
      report,
    );
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("a gate process failure leaves its raw output and exit result available", async () => {
  const { stateDirectory, briefPath } = await createTestDirectory("workshop-gate-process-");
  try {
    await assert.rejects(
      runWorkshopJob({
        job: {
          id: "gate-process-failure",
          repository: "gabchess/agent-factory",
          baseSha,
          paths: ["workshop/"],
        },
        stateDirectory,
        briefPath,
        gatePath,
        gateRevision,
        worker: async (job) => ({
          candidateSha: job.baseSha,
          summary: "Controlled fixture supplies a malformed worker report.",
          report: [
            "# Worker report: Route one simulated job through Mastra and the existing gate",
            "",
            "## Result",
            "",
            "PARTIAL: Simulation evidence from a controlled worker adapter fixture.",
            "",
            "## Loaded",
            "",
            "- Load: `implement`",
            "- Load: `tdd`",
            "- Load: `codebase-design`",
            "- Load: `mastra`",
            "- Load: `gabe-voice`",
            "- Load: `package-management`",
            "- Use: `ReadFile`",
            "- Use: `ShellExec`",
            "- Use: `apply_patch`",
            "",
            "## Could not verify",
            "",
            "- The fixture omits the required Ask section.",
            "",
          ].join("\n"),
        }),
        reviewer: async ({ worker }) => ({
          verdict: "pass",
          reviewedSha: worker.candidateSha,
          findings: [],
        }),
      }),
      /workflow ended with status failed/,
    );

    const evidence = JSON.parse(
      await readFile(path.join(stateDirectory, "dry-run-gate-process-failure.gate-process.json"), "utf8"),
    );
    assert.equal(evidence.executionId, "dry-run-gate-process-failure");
    assert.equal(evidence.exitCode, 1);
    assert.equal(evidence.stdout, "");
    assert.match(evidence.stderr, /report has no "## Ask"/);
    assert.match(evidence.processError.message, /Command failed/);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("an unknown independent verdict returns the gate retry decision", async () => {
  const { stateDirectory, briefPath } = await createTestDirectory("workshop-retry-");
  try {
    const result = await runWorkshopJob({
      job: {
        id: "unknown-review",
        repository: "gabchess/agent-factory",
        baseSha,
        paths: ["workshop/"],
      },
      stateDirectory,
      briefPath,
      gatePath,
      gateRevision,
      worker: async (job) => ({
        candidateSha: job.baseSha,
        summary: "Candidate is ready.",
        report: simulatedWorkerReport("The candidate adapter returns the scoped SHA."),
      }),
      reviewer: async ({ worker }) => ({
        verdict: "unknown",
        reviewedSha: worker.candidateSha,
        findings: [],
      }),
    });

    assert.equal(result.decision, "retry");
    assert.equal(result.gateRow.verdict, "fail");
    assert.match(result.gateRow.reason, /unknown verdict/);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("a review of a different SHA returns the gate retry decision", async () => {
  const { stateDirectory, briefPath } = await createTestDirectory("workshop-stale-review-");
  try {
    const result = await runWorkshopJob({
      job: {
        id: "stale-review",
        repository: "gabchess/agent-factory",
        baseSha,
        paths: ["workshop/"],
      },
      stateDirectory,
      briefPath,
      gatePath,
      gateRevision,
      worker: async (job) => ({
        candidateSha: job.baseSha,
        summary: "Candidate is ready.",
        report: simulatedWorkerReport("The candidate adapter returns the scoped SHA."),
      }),
      reviewer: async () => ({
        verdict: "pass",
        reviewedSha: "49dd4eebc4178a8f221f915033ce8d345668737e",
        findings: [],
      }),
    });

    assert.equal(result.decision, "retry");
    assert.equal(result.gateRow.verdict, "fail");
    assert.match(result.gateRow.reason, /does not match the candidate SHA/);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("an ask from the worker is recorded as a blocked gate outcome", async () => {
  const { stateDirectory, briefPath } = await createTestDirectory("workshop-blocked-");
  try {
    const result = await runWorkshopJob({
      job: {
        id: "worker-ask",
        repository: "gabchess/agent-factory",
        baseSha,
        paths: ["workshop/"],
      },
      stateDirectory,
      briefPath,
      gatePath,
      gateRevision,
      worker: async (job) => ({
        candidateSha: job.baseSha,
        summary: "Worker needs a scope decision.",
        report: simulatedWorkerReport(
          "The candidate adapter requests a scope decision.",
          "Confirm whether the approved path can include README.md.",
        ),
        ask: "Confirm whether the approved path can include README.md.",
      }),
      reviewer: async ({ worker }) => ({
        verdict: "pass",
        reviewedSha: worker.candidateSha,
        findings: [],
      }),
    });

    assert.equal(result.decision, "blocked");
    assert.equal(result.gateRow.status, "blocked");
    assert.equal(result.gateRow.ask, "Confirm whether the approved path can include README.md.");
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("an out-of-scope path is rejected before the worker starts", async () => {
  const { stateDirectory, briefPath } = await createTestDirectory("workshop-scope-");
  let workerStarted = false;
  try {
    await assert.rejects(
      runWorkshopJob({
        job: {
          id: "out-of-scope",
          repository: "gabchess/agent-factory",
          baseSha,
          paths: ["../banner-factory/"],
        },
        stateDirectory,
        briefPath,
        gatePath,
        gateRevision,
        worker: async (job) => {
          workerStarted = true;
          return {
            candidateSha: job.baseSha,
            summary: "Should not start.",
            report: simulatedWorkerReport("The worker should not start."),
          };
        },
        reviewer: async ({ worker }) => ({
          verdict: "pass",
          reviewedSha: worker.candidateSha,
          findings: [],
        }),
      }),
      /outside the approved scope/,
    );
    assert.equal(workerStarted, false);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("a base SHA outside the approved checkout is rejected before the worker starts", async () => {
  const { stateDirectory, briefPath } = await createTestDirectory("workshop-base-");
  let workerStarted = false;
  try {
    await assert.rejects(
      runWorkshopJob({
        job: {
          id: "unapproved-base",
          repository: "gabchess/agent-factory",
          baseSha: "49dd4eebc4178a8f221f915033ce8d345668737e",
          paths: ["workshop/"],
        },
        stateDirectory,
        briefPath,
        gatePath,
        gateRevision,
        worker: async (job) => {
          workerStarted = true;
          return {
            candidateSha: job.baseSha,
            summary: "Should not start.",
            report: simulatedWorkerReport("The worker should not start."),
          };
        },
        reviewer: async ({ worker }) => ({
          verdict: "pass",
          reviewedSha: worker.candidateSha,
          findings: [],
        }),
      }),
      /base SHA is not the approved checkout/,
    );
    assert.equal(workerStarted, false);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("one active job holds the state directory until its worker completes", async () => {
  const { stateDirectory, briefPath } = await createTestDirectory("workshop-active-");
  let releaseWorker;
  const workerWait = new Promise((resolve) => {
    releaseWorker = resolve;
  });
  const makeInput = (id) => ({
    job: { id, repository: "gabchess/agent-factory", baseSha, paths: ["workshop/"] },
    stateDirectory,
    briefPath,
    gatePath,
    gateRevision,
    worker: async (job) => {
      if (id === "first-active") await workerWait;
      return {
        candidateSha: job.baseSha,
        summary: "Candidate is ready.",
        report: simulatedWorkerReport("The candidate adapter returns the scoped SHA."),
      };
    },
    reviewer: async ({ worker }) => ({
      verdict: "pass",
      reviewedSha: worker.candidateSha,
      findings: [],
    }),
  });
  const first = runWorkshopJob(makeInput("first-active"));
  try {
    await new Promise((resolve) => setTimeout(resolve, 50));
    await assert.rejects(runWorkshopJob(makeInput("second-active")), /Another workshop job is active/);
  } finally {
    releaseWorker();
  }
  try {
    assert.equal((await first).decision, "passed");
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});
