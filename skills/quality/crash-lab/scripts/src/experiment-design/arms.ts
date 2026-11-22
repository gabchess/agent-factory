import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { copyTree, hashTree, makeTempDir } from "../util/fs.ts";
import { initSingleCommitRepo } from "../util/git.ts";
import { getArm, type ArmOp, type CaseSpec } from "./case.ts";

export interface BuiltArm {
  armId: string;
  dir: string;
  commit: string;
  treeHash: string;
}

export function buildArm(spec: CaseSpec, armId: string, outDir?: string): BuiltArm {
  const arm = getArm(spec, armId);
  if (outDir && existsSync(outDir) && readdirSync(outDir).length > 0) throw new Error(`arm destination ${outDir} is not empty`);
  const dir = outDir ?? makeTempDir("ws-");
  copyTree(spec.baseDir, dir);
  for (const op of arm.ops) applyOp(spec, dir, op);
  const treeHash = hashTree(dir);
  const commit = initSingleCommitRepo(dir);
  return { armId, dir, commit, treeHash };
}

export function buildArmFiles(spec: CaseSpec, armId: string | null): string {
  const dir = makeTempDir("files-");
  copyTree(spec.baseDir, dir);
  if (armId) for (const op of getArm(spec, armId).ops) applyOp(spec, dir, op);
  return dir;
}

function applyOp(spec: CaseSpec, dir: string, op: ArmOp): void {
  switch (op.op) {
    case "copy": {
      const target = join(dir, op.to);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(join(spec.dir, op.from)));
      return;
    }
    case "deleteLine": {
      const path = join(dir, op.path);
      const lines = readFileSync(path, "utf8").split("\n");
      const hits = lines.filter((l) => l === op.text).length;
      if (hits !== 1) throw new Error(`deleteLine ${op.path}: expected 1 exact match, found ${hits}`);
      writeFileSync(path, lines.filter((l) => l !== op.text).join("\n"));
      return;
    }
    case "replace": {
      const path = join(dir, op.path);
      const text = readFileSync(path, "utf8");
      const hits = text.split(op.from).length - 1;
      if (hits !== op.count) throw new Error(`replace ${op.path}: expected ${op.count} matches of ${JSON.stringify(op.from)}, found ${hits}`);
      writeFileSync(path, text.split(op.from).join(op.to));
      return;
    }
  }
}
