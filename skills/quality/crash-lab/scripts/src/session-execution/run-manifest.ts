import { existsSync, linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sha256 } from "../util/fs.ts";
import { runProcess } from "../util/proc.ts";
import type { Phase } from "../experiment-design/experiment.ts";

export interface RunManifest {
  runId: string;
  experimentSha256: string;
  checksSha256: string;
  cliVersion: string;
  model: string;
  gitCommit?: string;
  codeTree?: string;
  sandboxImageId?: string;
  createdAt?: string;
}

export interface RunPaths {
  runDir: string;
  phaseDir: string;
  attemptsLog: string;
}

const RUN_ID = /^[a-z0-9][a-z0-9-]{2,60}$/;
export const FROZEN_PATHS: readonly string[] = Object.freeze(["src", "sandbox", "cases", "checks", "experiments", "package.json"]);
const FROZEN_KEYS = ["experimentSha256", "checksSha256", "cliVersion", "model", "codeTree", "sandboxImageId"] as const;

export function runPaths(resultsRoot: string, runId: string, phase: Phase): RunPaths {
  if (!RUN_ID.test(runId)) throw new Error("live runs need --run-id (lowercase letters, digits, dashes)");
  const runDir = resolve(resultsRoot, "runs", runId);
  const phaseDir = join(runDir, phase);
  const attemptsLog = join(phaseDir, "attempts.jsonl");
  for (const f of [join(phaseDir, "report.json"), attemptsLog]) {
    if (existsSync(f)) throw new Error(`${f} already exists; ${phase} already has evidence under run ${runId}`);
  }
  return { runDir, phaseDir, attemptsLog };
}

function checked(cmd: string, args: string[]): string {
  const r = runProcess(cmd, args);
  if (r.code !== 0) throw new Error(`${cmd} ${args.join(" ")} failed: ${(r.stderr || r.stdout).trim().slice(-300)}`);
  return r.stdout;
}

export function codeTree(labRoot: string, commit: string): string {
  return sha256(Buffer.from(checked("git", ["-C", labRoot, "ls-tree", "-r", commit, "--", ...FROZEN_PATHS])));
}

export function freezeManifest(opts: { labRoot: string; runDir: string; sandboxImage: string; manifest: RunManifest }): RunManifest {
  const { labRoot, runDir, manifest } = opts;
  const path = join(runDir, "manifest.json");
  const commit = checked("git", ["-C", labRoot, "rev-parse", "HEAD"]).trim();
  if (checked("git", ["-C", labRoot, "status", "--porcelain", "--", ...FROZEN_PATHS]).trim()) {
    throw new Error("live runs need a clean tree for src/, sandbox/, cases/, checks/ and experiments/ so the manifest commit describes the code that ran");
  }
  const image = checked("docker", ["image", "inspect", "--format", "{{.Id}}", opts.sandboxImage]).trim();
  const current: RunManifest = { ...manifest, gitCommit: commit, codeTree: codeTree(labRoot, commit), sandboxImageId: image };
  mkdirSync(runDir, { recursive: true });
  const created = { ...current, createdAt: new Date().toISOString() };
  const draft = `${path}.${process.pid}.tmp`;
  writeFileSync(draft, JSON.stringify(created, null, 2), { flag: "wx" });
  try {
    linkSync(draft, path);
    return created;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  } finally {
    unlinkSync(draft);
  }
  const stored = JSON.parse(readFileSync(path, "utf8")) as RunManifest;
  const frozen = { ...stored, codeTree: stored.codeTree ?? codeTree(labRoot, stored.gitCommit ?? "HEAD") };
  for (const k of FROZEN_KEYS) {
    if (frozen[k] !== current[k]) throw new Error(`run ${manifest.runId} froze ${k}=${frozen[k]}, now ${current[k]}; start a new run id`);
  }
  return frozen;
}
