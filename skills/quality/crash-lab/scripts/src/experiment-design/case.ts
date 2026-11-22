import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expectShape, type FieldKind } from "../util/json-shape.ts";

export type ArmOp =
  | { op: "copy"; from: string; to: string }
  | { op: "deleteLine"; path: string; text: string }
  | { op: "replace"; path: string; from: string; to: string; count: number };

export interface AllowedLeak {
  path: string;
  text: string;
}

export interface ArmSpec {
  id: string;
  name: string;
  description: string;
  ops: ArmOp[];
  allowedLeaks: AllowedLeak[];
}

const OP_FIELDS: Record<string, Record<string, FieldKind>> = {
  copy: { from: "string", to: "string" },
  deleteLine: { path: "string", text: "string" },
  replace: { path: "string", from: "string", to: "string", count: "number" },
};

function checkArm(where: string, arm: unknown): void {
  expectShape(where, arm, { id: "string", name: "string", description: "string", ops: "array", allowedLeaks: "array" });
  const { ops, allowedLeaks } = arm as { ops: unknown[]; allowedLeaks: unknown[] };
  ops.forEach((op, i) => {
    const tag = (op as { op?: unknown } | null)?.op;
    const fields = typeof tag === "string" && Object.hasOwn(OP_FIELDS, tag) ? OP_FIELDS[tag] : undefined;
    if (!fields) throw new Error(`${where} ops[${i}]: unknown op`);
    expectShape(`${where} ops[${i}]`, op, fields);
  });
  allowedLeaks.forEach((leak, i) => expectShape(`${where} allowedLeaks[${i}]`, leak, { path: "string", text: "string" }));
}

export interface CaseSpec {
  id: string;
  description: string;
  dir: string;
  baseDir: string;
  taskText: string;
  heldOutPath: string;
  candidateCommand: string[];
  repoTestGlobs: string[];
  protectedPaths: string[];
  instructionFiles: string[];
  constraintLine: string;
  arms: ArmSpec[];
}

export function loadCase(caseDir: string): CaseSpec {
  const dir = resolve(caseDir);
  const raw = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
  expectShape(join(dir, "case.json"), raw, {
    id: "string", description: "string", base: "string", task: "string", heldOut: "string", constraintLine: "string",
    candidateCommand: "string[]", repoTestGlobs: "string[]", protectedPaths: "string[]", instructionFiles: "string[]", arms: "array",
  });
  raw.arms.forEach((arm: unknown, i: number) => checkArm(`${join(dir, "case.json")} arms[${i}]`, arm));
  const vars: Record<string, string> = { constraintLine: raw.constraintLine };
  const expand = (s: string): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  const expandDeep = <T>(v: T): T => JSON.parse(JSON.stringify(v), (_k, x) => (typeof x === "string" ? expand(x) : x));
  return {
    id: raw.id,
    description: raw.description,
    dir,
    baseDir: join(dir, raw.base),
    taskText: readFileSync(join(dir, raw.task), "utf8"),
    heldOutPath: resolve(dir, raw.heldOut),
    candidateCommand: raw.candidateCommand,
    repoTestGlobs: raw.repoTestGlobs,
    protectedPaths: raw.protectedPaths,
    instructionFiles: raw.instructionFiles,
    constraintLine: raw.constraintLine,
    arms: expandDeep(raw.arms),
  };
}

export function getArm(spec: CaseSpec, armId: string): ArmSpec {
  const arm = spec.arms.find((a) => a.id === armId);
  if (!arm) throw new Error(`case ${spec.id}: unknown arm ${armId}`);
  return arm;
}
