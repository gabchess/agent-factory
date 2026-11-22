import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { makeTempDir, sha256File } from "../util/fs.ts";

export interface ArtifactSnapshot {
  path: string;
  sha256: string;
  bytes: number;
}

export function snapshotWorkspace(dir: string, outDir: string, name: string): ArtifactSnapshot {
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${name}.tar`);
  if (existsSync(path)) throw new Error(`artifact ${path} already exists; refusing to overwrite`);
  const r = spawnSync("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-C", dir, "-cf", path, "."], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`snapshot of ${dir} failed: ${r.stderr}`);
  return { path, sha256: sha256File(path), bytes: statSync(path).size };
}

export function snapshotProblems(a: ArtifactSnapshot | null | undefined): string[] {
  if (!a) return ["no artifact snapshot"];
  if (!existsSync(a.path)) return [`artifact ${a.path} is missing`];
  const sha = sha256File(a.path);
  return sha === a.sha256 ? [] : [`artifact ${a.path} hash ${sha.slice(0, 12)} does not match the recorded ${a.sha256.slice(0, 12)}`];
}

export function locateSnapshot(a: ArtifactSnapshot, phaseDir: string): ArtifactSnapshot {
  if (existsSync(a.path)) return a;
  const moved = join(phaseDir, "artifacts", basename(a.path));
  return existsSync(moved) ? { ...a, path: moved } : a;
}

export function extractSnapshot(a: ArtifactSnapshot): string {
  const dir = makeTempDir("ws-");
  const r = spawnSync("tar", ["-C", dir, "-xf", a.path], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`extracting ${a.path} failed: ${r.stderr}`);
  return dir;
}
