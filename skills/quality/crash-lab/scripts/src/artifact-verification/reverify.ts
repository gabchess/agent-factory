import { readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { buildArm } from "../experiment-design/arms.ts";
import type { CaseSpec } from "../experiment-design/case.ts";
import type { AttemptRecord, AttemptStage } from "../session-execution/runner.ts";
import type { CandidateRunner } from "../util/proc.ts";
import type { SessionStatus } from "../adapters/types.ts";
import { extractSnapshot, locateSnapshot, snapshotProblems } from "./artifacts.ts";
import { verifyCandidate } from "./verify.ts";

export interface ReverifyEntry {
  slot: string;
  attempt: number;
  status: AttemptRecord["status"];
  recordedVerdict: string | null;
  reverifiedVerdict: string | null;
  match: boolean | null;
  artifactOk: boolean;
  problems: string[];
}

type LoggedAttempt = AttemptRecord & { slot: string; stage: AttemptStage };

export function reverifyAttempts(opts: { attemptsLog: string; caseSpec: CaseSpec; checksSha256: string; runner: CandidateRunner }): ReverifyEntry[] {
  const latest = new Map<string, LoggedAttempt>();
  const out: ReverifyEntry[] = [];
  const lines = readFileSync(opts.attemptsLog, "utf8").split("\n");
  for (const [i, line] of lines.entries()) {
    if (!line.trim()) continue;
    const bad = (problem: string): void => {
      out.push({ slot: `line ${i + 1}`, attempt: 0, status: "harness_error", recordedVerdict: null, reverifiedVerdict: null, match: null, artifactOk: false, problems: [`attempts log line ${i + 1} ${problem}`] });
    };
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      bad(`is not JSON: ${(err as Error).message}`);
      continue;
    }
    if (!isLoggedAttempt(parsed)) {
      bad("is not an attempt record (needs slot, attempt, a known status and stage)");
      continue;
    }
    const rec = parsed;
    const key = `${rec.slot}#${rec.attempt}`;
    const prev = latest.get(key);
    if (!prev || prev.stage === "session") latest.set(key, rec);
  }
  for (const rec of latest.values()) {
    const recordedVerdict = rec.stage === "terminal" ? (rec.verification?.verdict ?? null) : null;
    const entry: ReverifyEntry = { slot: rec.slot, attempt: rec.attempt, status: rec.status, recordedVerdict, reverifiedVerdict: null, match: null, artifactOk: true, problems: [] };
    if (rec.stage === "session") entry.problems.push("interrupted before its terminal record");
    if (rec.status !== "completed") {
      out.push(entry);
      continue;
    }
    const artifact = rec.artifact && locateSnapshot(rec.artifact, dirname(opts.attemptsLog));
    const artifactProblems = snapshotProblems(artifact);
    entry.problems.push(...artifactProblems);
    entry.artifactOk = artifactProblems.length === 0;
    if (artifact && artifactProblems.length === 0) {
      let dir: string | null = null;
      try {
        dir = extractSnapshot(artifact);
        const v = verifyCandidate({ spec: opts.caseSpec, armDir: buildArm(opts.caseSpec, rec.slot.split(":")[1]).dir, candidateDir: dir, expectedChecksSha256: opts.checksSha256, runner: opts.runner });
        entry.reverifiedVerdict = v.verdict;
        entry.match = recordedVerdict === null ? null : recordedVerdict === v.verdict;
      } catch (err) {
        entry.artifactOk = false;
        entry.problems.push(`reverification failed: ${(err as Error).message}`);
      } finally {
        if (dir) rmSync(dir, { recursive: true, force: true });
      }
    }
    out.push(entry);
  }
  return out.sort((a, b) => a.slot.localeCompare(b.slot) || a.attempt - b.attempt);
}

const SESSION_STATUSES = new Set<string>(["completed", "timeout", "budget_exceeded", "harness_error", "credit_exhausted"] satisfies SessionStatus[]);

function isLoggedAttempt(v: unknown): v is LoggedAttempt {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  return typeof r.slot === "string" && Number.isInteger(r.attempt) && typeof r.status === "string" && SESSION_STATUSES.has(r.status) && (r.stage === "session" || r.stage === "terminal");
}
