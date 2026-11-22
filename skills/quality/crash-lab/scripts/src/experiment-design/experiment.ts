import type { PriceTable } from "../session-execution/pricing.ts";
import { readFileSync } from "node:fs";
import { sha256 } from "../util/fs.ts";
import { expectShape } from "../util/json-shape.ts";

export type Phase = "smoke" | "pilot" | "main";

export interface Comparison {
  a: string;
  b: string;
  role: "primary" | "exploratory";
  question: string;
}

export interface ExperimentSpec {
  id: string;
  case: string;
  harness: { adapter: string; cliVersion: string; model: string; ruleset: string };
  arms: string[];
  phases: Record<Phase, { runsPerArm: number; purpose: string }>;
  retries: { maxRetriesPerSlot: number; retryOn: "harness_error"[] };
  limits: { maxTurns: number; timeoutMinutes: number; maxCostUsdPerAttempt: number };
  pricing?: PriceTable;
  budget: { capUsd: number; confirmed: boolean; experimentCapUsd?: number };
  alpha: number;
  invalidIfUnresolvedShareAbove: number;
  checksSha256: string;
  seed: number;
  comparisons: Comparison[];
  hypotheses: string[];
}

export interface Slot {
  key: string;
  phase: Phase;
  arm: string;
  index: number;
}

export function loadExperiment(path: string): { spec: ExperimentSpec; sha256: string } {
  const text = readFileSync(path, "utf8");
  const raw: unknown = JSON.parse(text);
  expectShape(path, raw, {
    id: "string", case: "string", "harness.adapter": "string", "harness.cliVersion": "string", "harness.model": "string", "harness.ruleset": "string",
    arms: "string[]", "phases.smoke.runsPerArm": "number", "phases.pilot.runsPerArm": "number", "phases.main.runsPerArm": "number",
    "retries.maxRetriesPerSlot": "number", "retries.retryOn": "string[]",
    "limits.maxTurns": "number", "limits.timeoutMinutes": "number", "limits.maxCostUsdPerAttempt": "number",
    "budget.capUsd": "number", "budget.confirmed": "boolean", alpha: "number", invalidIfUnresolvedShareAbove: "number",
    checksSha256: "string", seed: "number", comparisons: "array", hypotheses: "string[]",
  });
  (raw as { comparisons: unknown[] }).comparisons.forEach((c, i) => {
    expectShape(`${path} comparisons[${i}]`, c, { a: "string", b: "string", role: "string", question: "string" });
    if (!["primary", "exploratory"].includes((c as Comparison).role)) throw new Error(`${path} comparisons[${i}]: role must be primary or exploratory`);
  });
  if ((raw as { pricing?: unknown }).pricing !== undefined) {
    expectShape(path, raw, {
      "pricing.model": "string", "pricing.input": "number", "pricing.output": "number", "pricing.cacheWrite5m": "number",
      "pricing.cacheWrite1h": "number", "pricing.cacheRead": "number", "pricing.source": "string",
    });
  }
  const spec = raw as ExperimentSpec;
  const counts = [spec.retries.maxRetriesPerSlot, spec.phases.smoke.runsPerArm, spec.phases.pilot.runsPerArm, spec.phases.main.runsPerArm];
  if (!counts.every((n) => Number.isInteger(n) && n >= 0)) throw new Error(`${path}: retries.maxRetriesPerSlot and every runsPerArm must be non-negative integers`);
  if (spec.budget.capUsd < 0 || spec.limits.maxCostUsdPerAttempt <= 0 || spec.limits.maxTurns <= 0 || spec.limits.timeoutMinutes <= 0) {
    throw new Error(`${path}: budget.capUsd must be non-negative and every limit positive`);
  }
  if (!(spec.alpha > 0 && spec.alpha < 1)) throw new Error(`${path}: alpha ${spec.alpha} is not between 0 and 1`);
  const cap: unknown = spec.budget.experimentCapUsd;
  if (cap !== undefined && (typeof cap !== "number" || !Number.isFinite(cap) || cap < 0)) {
    throw new Error(`${path}: budget.experimentCapUsd ${JSON.stringify(cap)} is not a non-negative number of USD`);
  }
  return { spec, sha256: sha256(text) };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function schedule(spec: ExperimentSpec, phase: Phase): Slot[] {
  const phaseSeed = spec.seed + { smoke: 1, pilot: 2, main: 3 }[phase];
  const rand = mulberry32(phaseSeed);
  const slots: Slot[] = [];
  for (let index = 0; index < spec.phases[phase].runsPerArm; index++) {
    const order = [...spec.arms];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const arm of order) slots.push({ key: `${phase}:${arm}:${index}`, phase, arm, index });
  }
  return slots;
}

export interface CostPlan {
  rows: Array<{ phase: Phase; slots: number; expectedAttempts: number; worstCaseAttempts: number }>;
  expectedAttempts: number;
  worstCaseAttempts: number;
  perAttemptUsd: { low: number; high: number };
  expectedUsd: { low: number; high: number };
  worstCaseUsd: number;
  capUsd: number;
  fitsCap: boolean;
}

function effectiveCapUsd(spec: ExperimentSpec): number {
  const { capUsd, experimentCapUsd } = spec.budget;
  return experimentCapUsd === undefined ? capUsd : Math.min(capUsd, experimentCapUsd);
}

export function planCost(spec: ExperimentSpec, perAttemptUsd: { low: number; high: number }, retryRate = 0.1): CostPlan {
  const phases: Phase[] = ["smoke", "pilot", "main"];
  const rows = phases.map((phase) => {
    const slots = spec.phases[phase].runsPerArm * spec.arms.length;
    return {
      phase,
      slots,
      expectedAttempts: slots + Math.ceil(slots * retryRate),
      worstCaseAttempts: slots * (1 + spec.retries.maxRetriesPerSlot),
    };
  });
  const expectedAttempts = rows.reduce((s, r) => s + r.expectedAttempts, 0);
  const worstCaseAttempts = rows.reduce((s, r) => s + r.worstCaseAttempts, 0);
  const expectedUsd = { low: expectedAttempts * perAttemptUsd.low, high: expectedAttempts * perAttemptUsd.high };
  return {
    rows,
    expectedAttempts,
    worstCaseAttempts,
    perAttemptUsd,
    expectedUsd,
    worstCaseUsd: worstCaseAttempts * spec.limits.maxCostUsdPerAttempt,
    capUsd: effectiveCapUsd(spec),
    fitsCap: expectedUsd.high <= effectiveCapUsd(spec),
  };
}
