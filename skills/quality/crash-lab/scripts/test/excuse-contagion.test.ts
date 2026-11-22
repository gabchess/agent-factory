import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { loadCase } from "../src/experiment-design/case.ts";
import { buildArm } from "../src/experiment-design/arms.ts";
import { auditArm } from "../src/experiment-design/contamination.ts";
import { loadExperiment, schedule } from "../src/experiment-design/experiment.ts";
import { applyFixture, fakeAdapter, loadFixture, type ScriptedAttempt } from "../src/adapters/fake.ts";
import { verifyCandidate } from "../src/artifact-verification/verify.ts";
import { hostRunner } from "../src/util/proc.ts";
import { buildReport } from "../src/evidence-reporting/report.ts";
import { newLedger, runPhase } from "../src/session-execution/runner.ts";
import { listFiles, sha256File } from "../src/util/fs.ts";
import { ROOT } from "./helpers.ts";

const spec = loadCase(join(ROOT, "cases", "excuse-contagion"));
const fixtures = join(ROOT, "fixtures", "candidates", "excuse-contagion");
const { spec: experiment, sha256 } = loadExperiment(join(ROOT, "experiments", "excuse-contagion.json"));
const helper = "src/orders/amounts.ts";

const changedFrom = (a: string, b: string): string[] =>
  listFiles(a).filter((f) => readFileSync(join(a, f), "utf8") !== readFileSync(join(b, f), "utf8"));

test("every arm audits clean and differs from E0 only in the shared helper", () => {
  const silent = buildArm(spec, "E0").dir;
  for (const arm of spec.arms) {
    const dir = buildArm(spec, arm.id).dir;
    assert.deepEqual(auditArm(spec, arm.id, dir).findings, [], arm.id);
    assert.deepEqual(listFiles(dir), listFiles(silent), arm.id);
    assert.deepEqual(changedFrom(dir, silent), arm.id === "E0" ? [] : [helper], arm.id);
  }
});

test("the excused arm adds exactly the excuse comment and keeps the hack", () => {
  const silent = readFileSync(join(buildArm(spec, "E0").dir, helper), "utf8");
  const excused = readFileSync(join(buildArm(spec, "E1").dir, helper), "utf8");
  assert.equal(excused.replace(`${spec.constraintLine}\n`, ""), silent);
  assert.match(excused, /for now/);
});

test("fixtures separate copying the float helper from exact formatting", () => {
  const checks = sha256File(spec.heldOutPath);
  for (const name of readdirSync(fixtures).filter((n) => !n.startsWith("_"))) {
    const fixture = loadFixture(fixtures, name);
    const ws = buildArm(spec, fixture.arm);
    applyFixture(fixtures, name, ws.dir);
    const result = verifyCandidate({ runner: hostRunner, spec, armDir: buildArm(spec, fixture.arm).dir, candidateDir: ws.dir, expectedChecksSha256: checks });
    assert.equal(result.verdict, fixture.expect.verdict, `${name}: ${result.reasons.join("; ")}`);
    for (const want of fixture.expect.reasonIncludes) assert.ok(result.reasons.some((r) => r.includes(want)), `${name} missing ${want}`);
  }
});

test("the experiment pins this case's checks and is approved only up to its own cap", () => {
  assert.equal(experiment.checksSha256, sha256File(spec.heldOutPath));
  assert.equal(experiment.budget.confirmed, false);
  assert.equal(experiment.budget.experimentCapUsd, 5);
  assert.deepEqual(experiment.comparisons.find((c) => c.role === "primary"), { ...experiment.comparisons[0], a: "E0", b: "E1" });
});

test("a scripted rehearsal of this case is never a finding, even relabeled live", async () => {
  const outcome: Record<string, string> = { E0: "reuse-helper", E1: "own-exact-format", E2: "reuse-exact-helper" };
  const script: Record<string, ScriptedAttempt[]> = {};
  const rehearsal = { ...experiment, phases: { ...experiment.phases, main: { ...experiment.phases.main, runsPerArm: 1 } } };
  for (const slot of schedule(rehearsal, "main")) script[slot.key] = [{ status: "completed", fixture: outcome[slot.arm], costUsd: 0.01, turns: 1, claim: "success" }];
  const ledger = newLedger(experiment.budget.capUsd);
  const results = await runPhase({ experiment: rehearsal, caseSpec: spec, phase: "main", adapter: fakeAdapter(fixtures, script), ledger });
  assert.deepEqual(results.map((r) => `${r.slot.arm}:${r.verdict}`).sort(), ["E0:fail", "E1:pass", "E2:pass"]);
  const version = { harness: "fake", cliVersion: "offline", model: "none" };
  for (const label of ["offline-simulation", "live"] as const) {
    const report = buildReport({ label, experiment: rehearsal, experimentSha256: sha256, phase: "main", version, results, ledger });
    assert.equal(report.valid, true, report.validityNotes.join("; "));
    assert.equal(report.findingsEligible, false, label);
    assert.ok(report.validityNotes.some((n) => n.includes(label === "live" ? "labeled live but not backed" : "offline simulation")), label);
  }
});
