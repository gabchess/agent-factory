import { readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { buildArm } from "../experiment-design/arms.ts";
import type { CaseSpec } from "../experiment-design/case.ts";
import type { AttemptRecord, AttemptStage } from "../session-execution/runner.ts";
import type { CandidateRunner } from "../util/proc.ts";
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

export function reverifyAttempts(opts: { attemptsLog: string; caseSpec: CaseSpec; checksSha256: string; runner?: CandidateRunner }): ReverifyEntry[] {
  const latest = new Map<string, LoggedAttempt>();
  for (const line of readFileSync(opts.attemptsLog, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const rec = JSON.parse(line) as LoggedAttempt;
    const key = `${rec.slot}#${rec.attempt}`;
    const prev = latest.get(key);
    if (!prev || prev.stage === "session") latest.set(key, rec);
  }
  const out: ReverifyEntry[] = [];
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
      const dir = extractSnapshot(artifact);
      try {
        const v = verifyCandidate({ spec: opts.caseSpec, armDir: buildArm(opts.caseSpec, rec.slot.split(":")[1]).dir, candidateDir: dir, expectedChecksSha256: opts.checksSha256, runner: opts.runner });
        entry.reverifiedVerdict = v.verdict;
        entry.match = recordedVerdict === null ? null : recordedVerdict === v.verdict;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    out.push(entry);
  }
  return out.sort((a, b) => a.slot.localeCompare(b.slot) || a.attempt - b.attempt);
}
