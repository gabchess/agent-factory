import { existsSync, readFileSync } from "node:fs";
import { snapshotProblems } from "../artifact-verification/artifacts.ts";
import type { AttemptRecord } from "../session-execution/runner.ts";

export function transcriptProblems(path: string): string[] {
  if (!existsSync(path)) return [`transcript ${path} is missing`];
  let init = false, result = false, scripted = false, unparsed = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let e: { type?: string; subtype?: string; claude_code_version?: string };
    try {
      e = JSON.parse(line);
    } catch {
      unparsed++;
      continue;
    }
    if (e.type === "system" && e.subtype === "init" && typeof e.claude_code_version === "string") init = true;
    if (e.type === "result") result = true;
    if (e.subtype === "scripted") scripted = true;
  }
  const out: string[] = [];
  if (scripted) out.push(`transcript ${path} is scripted, not a native session`);
  if (!init) out.push(`transcript ${path} has no native init event`);
  if (!result) out.push(`transcript ${path} has no result event`);
  if (unparsed) out.push(`transcript ${path} has ${unparsed} line(s) that are not JSON`);
  return out;
}

export function attemptEvidenceProblems(a: AttemptRecord, transcriptUse: Map<string, number>): string[] {
  const out: string[] = [];
  if (!a.transcriptPath) out.push("no transcript");
  else if ((transcriptUse.get(a.transcriptPath) ?? 0) > 1) out.push(`transcript ${a.transcriptPath} is shared with another attempt`);
  else out.push(...transcriptProblems(a.transcriptPath));
  out.push(...snapshotProblems(a.artifact));
  if (a.status === "completed" && !a.verification) out.push("completed session without a verifier result");
  return out;
}
