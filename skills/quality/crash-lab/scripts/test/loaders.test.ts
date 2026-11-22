import assert from "node:assert/strict";
import { test } from "node:test";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadExperiment } from "../src/experiment-design/experiment.ts";
import { loadCase } from "../src/experiment-design/case.ts";
import { BudgetLedger } from "../src/session-execution/ledger.ts";
import { makeTempDir } from "../src/util/fs.ts";
import { EXPERIMENT } from "./helpers.ts";

const ROOT = join(import.meta.dirname, "..");

function experimentWith(change: (e: Record<string, any>) => void): string {
  const e = JSON.parse(readFileSync(EXPERIMENT, "utf8"));
  change(e);
  const path = join(makeTempDir("exp-"), "experiment.json");
  writeFileSync(path, JSON.stringify(e));
  return path;
}

test("an experiment whose budget cap is not a number is refused before anything runs", () => {
  assert.throws(() => loadExperiment(experimentWith((e) => (e.budget.capUsd = "50"))), /budget\.capUsd \(number\)/);
});

test("an experiment with a missing limit or an alpha outside (0, 1) is refused", () => {
  assert.throws(() => loadExperiment(experimentWith((e) => delete e.limits.maxTurns)), /limits\.maxTurns/);
  assert.throws(() => loadExperiment(experimentWith((e) => (e.budget.confirmed = "yes"))), /budget\.confirmed \(boolean\)/);
  assert.throws(() => loadExperiment(experimentWith((e) => (e.alpha = 5))), /alpha 5/);
});

test("an experiment with an incomplete pricing table is refused", () => {
  assert.throws(() => loadExperiment(experimentWith((e) => delete e.pricing.cacheRead)), /pricing\.cacheRead \(number\)/);
  assert.doesNotThrow(() => loadExperiment(experimentWith((e) => delete e.pricing)));
});

test("an experiment with a malformed comparison is refused", () => {
  assert.throws(() => loadExperiment(experimentWith((e) => (e.comparisons = [null]))), /comparisons\[0\]: missing or invalid a/);
  assert.throws(() => loadExperiment(experimentWith((e) => (e.comparisons[0].role = "main"))), /role must be primary or exploratory/);
});

test("an experiment with a negative retry count is refused", () => {
  assert.throws(() => loadExperiment(experimentWith((e) => (e.retries.maxRetriesPerSlot = -1))), /non-negative integers/);
});

test("a case with an arm that is not an arm is refused", () => {
  const dir = makeTempDir("case-");
  cpSync(join(ROOT, "cases", "legacy-cents"), dir, { recursive: true });
  const c = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
  c.arms = [null];
  writeFileSync(join(dir, "case.json"), JSON.stringify(c));
  assert.throws(() => loadCase(dir), /arms\[0\]: missing or invalid id/);
  c.arms = [{ id: "a", name: "a", description: "a", ops: [null], allowedLeaks: [] }];
  writeFileSync(join(dir, "case.json"), JSON.stringify(c));
  assert.throws(() => loadCase(dir), /arms\[0\] ops\[0\]: unknown op/);
  c.arms[0].ops = [{ op: "constructor" }];
  writeFileSync(join(dir, "case.json"), JSON.stringify(c));
  assert.throws(() => loadCase(dir), /arms\[0\] ops\[0\]: unknown op/);
  c.arms = [{ id: "a", name: "a", description: "a", ops: [], allowedLeaks: [null] }];
  writeFileSync(join(dir, "case.json"), JSON.stringify(c));
  assert.throws(() => loadCase(dir), /allowedLeaks\[0\]: missing or invalid path/);
});

test("a ledger with a negative amount is refused", () => {
  const path = join(makeTempDir("ledger-"), "ledger.json");
  writeFileSync(path, JSON.stringify({ capUsd: 2, entries: [{ id: 0, slot: "s", reservedUsd: -10, chargedUsd: null }] }));
  assert.throws(() => BudgetLedger.open(path, 2), /entry 0/);
  assert.equal(existsSync(`${path}.lock`), false);
  writeFileSync(path, JSON.stringify({ capUsd: 2, entries: [{ id: 0, slot: "s", reservedUsd: 1, chargedUsd: 1, reportedUsd: "bad" }] }));
  assert.throws(() => BudgetLedger.open(path, 2), /entry 0/);
});

test("a case without protected paths as a string list is refused", () => {
  const dir = makeTempDir("case-");
  cpSync(join(ROOT, "cases", "legacy-cents"), dir, { recursive: true });
  const c = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
  c.protectedPaths = "checks";
  writeFileSync(join(dir, "case.json"), JSON.stringify(c));
  assert.throws(() => loadCase(dir), /protectedPaths \(string\[\]\)/);
});

test("a corrupt ledger is refused and its lock released", () => {
  const path = join(makeTempDir("ledger-"), "ledger.json");
  writeFileSync(path, JSON.stringify({ capUsd: 2, entries: [{ id: 0, slot: "s", reservedUsd: "2", chargedUsd: null }] }));
  assert.throws(() => BudgetLedger.open(path, 2), /entry 0/);
  assert.equal(existsSync(`${path}.lock`), false);
});

test("a ledger lock that cannot be created reports the real cause, not a competing runner", () => {
  const path = join(makeTempDir("ledger-"), "missing-dir", "ledger.json");
  assert.throws(() => BudgetLedger.open(path, 2), (err: Error) => /could not be created/.test(err.message) && !/another runner/.test(err.message));
});
