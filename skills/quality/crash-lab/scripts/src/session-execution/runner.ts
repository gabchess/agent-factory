import { buildArm } from "../experiment-design/arms.ts";
import type { CaseSpec } from "../experiment-design/case.ts";
import { schedule, type ExperimentSpec, type Phase, type Slot } from "../experiment-design/experiment.ts";
import { unknownVerification, verifyCandidate, type VerificationResult } from "../artifact-verification/verify.ts";
import type { HarnessAdapter, RunOutcome } from "../adapters/types.ts";
import { rmSync } from "node:fs";
import { makeTempDir } from "../util/fs.ts";
import { snapshotWorkspace, type ArtifactSnapshot } from "../artifact-verification/artifacts.ts";
import { hostRunner, type CandidateRunner } from "../util/proc.ts";
import { BudgetLedger } from "./ledger.ts";

export type SlotVerdict = "pass" | "fail" | "unknown" | "not_run";

export interface AttemptRecord {
  attempt: number;
  ledgerEntry: number;
  status: RunOutcome["status"];
  costUsd: number;
  costKnown: boolean;
  turns: number | "unknown";
  wallMs: number;
  usage: RunOutcome["usage"];
  transcriptPath: string | null;
  claim: RunOutcome["finalClaim"];
  error?: string;
  observed?: RunOutcome["observed"];
  artifact?: ArtifactSnapshot | null;
  artifactError?: string;
  verification: VerificationResult | null;
}

export type AttemptStage = "session" | "terminal";

export interface SlotResult {
  slot: Slot;
  verdict: SlotVerdict;
  reasons: string[];
  attempts: AttemptRecord[];
  verification: VerificationResult | null;
  claimedSuccessButFailed: boolean;
}

export type Ledger = BudgetLedger;

export function newLedger(capUsd: number): Ledger {
  return BudgetLedger.memory(capUsd);
}

export async function runPhase(opts: {
  experiment: ExperimentSpec;
  caseSpec: CaseSpec;
  phase: Phase;
  adapter: HarnessAdapter;
  ledger: Ledger;
  concurrency?: number;
  candidateRunner?: CandidateRunner;
  onSlot?: (r: SlotResult) => void;
  onAttempt?: (slotKey: string, attempt: AttemptRecord, stage: AttemptStage) => void;
  artifactDir?: string;
  runId?: string;
}): Promise<SlotResult[]> {
  const { experiment, caseSpec, phase, adapter, ledger } = opts;
  if (adapter.live && !experiment.budget.confirmed) {
    throw new Error("live adapter refused: the experiment budget is not confirmed");
  }
  if (adapter.live && (!opts.candidateRunner || opts.candidateRunner === hostRunner)) {
    throw new Error("live adapter refused: candidate code must be verified in the sandbox, not on the host");
  }
  const slots = schedule(experiment, phase);
  const results: SlotResult[] = slots.map((slot) => ({ slot, verdict: "not_run", reasons: [], attempts: [], verification: null, claimedSuccessButFailed: false }));
  let stop: string | null = null;
  let next = 0;
  let active = 0;
  let waiters: Array<() => void> = [];
  const settled = (): Promise<void> => new Promise((resolve) => waiters.push(resolve));
  const release = (): void => {
    active--;
    const ready = waiters;
    waiters = [];
    for (const wake of ready) wake();
  };
  const reserveAttempt = async (slotKey: string, attempt: number): Promise<number | null> => {
    for (;;) {
      if (stop) return null;
      const id = ledger.reserve(slotKey, attempt, experiment.limits.maxCostUsdPerAttempt, {
        runId: opts.runId,
        experiment: experiment.id,
        experimentCapUsd: experiment.budget.experimentCapUsd,
      });
      if (id !== null) {
        active++;
        return id;
      }
      if (active === 0) return null;
      await settled();
    }
  };
  const worker = async (): Promise<void> => {
    while (next < results.length) {
      const result = results[next++];
      if (stop) {
        result.reasons.push(`${stop} before this slot`);
        continue;
      }
      await runSlot(result);
      opts.onSlot?.(result);
    }
  };
  const runSlot = async (result: SlotResult): Promise<void> => {
    const { slot } = result;
    const retries = experiment.retries.retryOn.includes("harness_error") ? experiment.retries.maxRetriesPerSlot : 0;
    for (let attempt = 1; attempt <= 1 + retries; attempt++) {
      if (stop) {
        result.reasons.push(stop);
        if (result.attempts.length > 0) result.verdict = "unknown";
        return;
      }
      const reservation = await reserveAttempt(slot.key, attempt);
      if (reservation === null) {
        if (stop) {
          result.reasons.push(stop);
          if (result.attempts.length > 0) result.verdict = "unknown";
          return;
        }
        stop = "budget cap reached";
        result.reasons.push(stop);
        if (result.attempts.length > 0) result.verdict = "unknown";
        return;
      }
      const ws = buildArm(caseSpec, slot.arm);
      const home = makeTempDir("home-");
      const outcome = await safeRun(adapter, {
        workdir: ws.dir,
        home,
        prompt: caseSpec.taskText,
        model: experiment.harness.model,
        maxTurns: experiment.limits.maxTurns,
        timeoutMs: experiment.limits.timeoutMinutes * 60_000,
        maxCostUsd: experiment.limits.maxCostUsdPerAttempt,
        slotKey: slot.key,
      });
      const costKnown = typeof outcome.usage.costUsd === "number";
      let cost: number;
      try {
        cost = ledger.charge(reservation, outcome.usage.costUsd, outcome.usage.reportedCostUsd ?? outcome.usage.costUsd);
      } finally {
        release();
      }
      const record: AttemptRecord = {
        attempt, ledgerEntry: reservation, status: outcome.status, costUsd: cost, costKnown, turns: outcome.usage.turns,
        wallMs: outcome.usage.wallMs, usage: outcome.usage, transcriptPath: outcome.transcriptPath, claim: outcome.finalClaim,
        error: outcome.error, verification: null, observed: outcome.observed, artifact: null,
      };
      if (opts.artifactDir) {
        try {
          record.artifact = snapshotWorkspace(ws.dir, opts.artifactDir, `${slot.key.replace(/:/g, "_")}_attempt${attempt}`);
        } catch (err) {
          record.artifactError = `${(err as Error).message}; workspace kept at ${ws.dir}, session home kept at ${home}`;
        }
      }
      result.attempts.push(record);
      opts.onAttempt?.(result.slot.key, record, "session");
      const terminal = (): void => {
        opts.onAttempt?.(result.slot.key, record, "terminal");
        if (opts.artifactDir && !record.artifactError) for (const d of [ws.dir, home]) rmSync(d, { recursive: true, force: true });
      };

      if (outcome.status === "credit_exhausted") {
        stop = "blocked: provider credit exhausted";
        result.reasons.push(`${stop}${outcome.error ? `: ${outcome.error}` : ""}`);
        result.verdict = "not_run";
        terminal();
        return;
      }
      if (outcome.status === "harness_error") {
        result.reasons.push(`attempt ${attempt}: harness error${outcome.error ? `: ${outcome.error}` : ""}`);
        result.verdict = "unknown";
        terminal();
        continue;
      }
      if (outcome.status === "timeout" || outcome.status === "budget_exceeded") {
        result.verdict = "fail";
        result.reasons.push(`session ${outcome.status}`);
        terminal();
        return;
      }
      let verification: VerificationResult;
      try {
        const armRef = buildArm(caseSpec, slot.arm);
        verification = verifyCandidate({ spec: caseSpec, armDir: armRef.dir, candidateDir: ws.dir, expectedChecksSha256: experiment.checksSha256, runner: opts.candidateRunner ?? hostRunner });
      } catch (err) {
        verification = unknownVerification(`verifier crashed: ${(err as Error).message}`);
      }
      record.verification = verification;
      result.verification = verification;
      result.verdict = verification.verdict;
      result.reasons.push(...verification.reasons);
      const over = overLimit(record, experiment);
      if (over.length) {
        result.verdict = "fail";
        result.reasons.push(...over);
      }
      result.claimedSuccessButFailed = outcome.finalClaim === "success" && verification.verdict === "fail";
      terminal();
      return;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 1) }, worker));
  return results;
}

function overLimit(a: AttemptRecord, e: ExperimentSpec): string[] {
  const out: string[] = [];
  if (a.costKnown && a.costUsd > e.limits.maxCostUsdPerAttempt + 1e-9) out.push(`over limit: cost $${a.costUsd.toFixed(2)} > $${e.limits.maxCostUsdPerAttempt}`);
  if (typeof a.turns === "number" && a.turns > e.limits.maxTurns) out.push(`over limit: ${a.turns} turns > ${e.limits.maxTurns}`);
  if (a.wallMs > e.limits.timeoutMinutes * 60_000) out.push(`over limit: wall time ${Math.round(a.wallMs / 1000)}s > ${e.limits.timeoutMinutes} min`);
  return out;
}

async function safeRun(adapter: HarnessAdapter, req: Parameters<HarnessAdapter["run"]>[0]): Promise<RunOutcome> {
  try {
    return await adapter.run(req);
  } catch (err) {
    return {
      status: "harness_error",
      usage: { costUsd: "unknown", inputTokens: "unknown", outputTokens: "unknown", cacheReadTokens: "unknown", turns: "unknown", wallMs: 0 },
      finalClaim: "none",
      transcriptPath: null,
      error: (err as Error).message,
    };
  }
}
