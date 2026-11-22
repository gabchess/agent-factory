import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeAdapter, type ScriptedAttempt } from "../src/adapters/fake.ts";
import { claudeCodeAdapter } from "../src/adapters/claude-code.ts";
import { loadExperiment, planCost, schedule, type ExperimentSpec } from "../src/experiment-design/experiment.ts";
import { buildReport, compareArms, renderMarkdown } from "../src/evidence-reporting/report.ts";
import { newLedger, runPhase } from "../src/session-execution/runner.ts";
import { chargeFor } from "../src/session-execution/pricing.ts";
import { BudgetLedger } from "../src/session-execution/ledger.ts";
import { EXPERIMENT, FIXTURES, loadDemoCase } from "./helpers.ts";
import { join } from "node:path";
import { appendFileSync, cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { reverifyAttempts } from "../src/artifact-verification/reverify.ts";
import { makeTempDir } from "../src/util/fs.ts";
import { hostRunner } from "../src/util/proc.ts";

const caseSpec = loadDemoCase();
const { spec: base, sha256 } = loadExperiment(EXPERIMENT);
const small = (over: Partial<ExperimentSpec> = {}): ExperimentSpec => ({
  ...base,
  phases: { ...base.phases, main: { ...base.phases.main, runsPerArm: 2 } },
  ...over,
});
const ok = (fixture: string, cost = 0.5): ScriptedAttempt => ({ status: "completed", fixture, costUsd: cost, turns: 12, claim: "success" });
const goodFor: Record<string, string> = { A0: "good-bigint", A1: "good-string-math", A2: "dollars-assumption", A3: "good-minor-units-field" };

test("the schedule is seeded, blocked by round, and covers every arm", () => {
  const s = schedule(base, "main");
  assert.equal(s.length, 40);
  assert.deepEqual(schedule(base, "main"), s);
  for (let round = 0; round < 10; round++) assert.deepEqual(s.slice(round * 4, round * 4 + 4).map((x) => x.arm).sort(), ["A0", "A1", "A2", "A3"]);
  assert.notDeepEqual(s.slice(0, 4).map((x) => x.arm), s.slice(4, 8).map((x) => x.arm));
});

test("the significance reference says when no split can reach alpha at this N", () => {
  const exp = small({ alpha: 0.01, phases: { ...base.phases, main: { ...base.phases.main, runsPerArm: 4 } } });
  const report = buildReport({ label: "offline-simulation", experiment: exp, experimentSha256: sha256, phase: "main", version: { harness: "fake", cliVersion: "offline", model: "none" }, results: [], ledger: newLedger(50) });
  assert.deepEqual(report.significanceReference, { n: 4, alpha: 0.01, otherArmMaxPasses: null });
  assert.match(renderMarkdown(report), /no split reaches p < 0\.01 at 4 runs per arm/);
});

test("live adapters are refused while the budget is unconfirmed", async () => {
  const adapter = claudeCodeAdapter({ bin: "/nonexistent", path: "", apiKey: "", transcriptDir: "/tmp", pinnedVersion: "0" });
  await assert.rejects(runPhase({ experiment: { ...base, budget: { capUsd: 50, confirmed: false } }, caseSpec, phase: "smoke", adapter, ledger: newLedger(50) }), /budget is not confirmed/);
});

test("harness errors retry, then become unknown; every attempt is charged", async () => {
  const exp = small();
  const script: Record<string, ScriptedAttempt[]> = {};
  for (const slot of schedule(exp, "main")) script[slot.key] = [ok(goodFor[slot.arm])];
  script["main:A0:0"] = [{ status: "harness_error", costUsd: 0.1, turns: 1, claim: "none" }, ok("good-bigint")];
  script["main:A1:0"] = [{ status: "harness_error", costUsd: 0.1, turns: 1, claim: "none" }];
  script["main:A1:1"] = [{ status: "timeout", costUsd: 2, turns: 40, claim: "none" }];
  const ledger = newLedger(50);
  const results = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger });
  const by = (k: string) => results.find((r) => r.slot.key === k)!;
  assert.equal(by("main:A0:0").verdict, "pass");
  assert.equal(by("main:A0:0").attempts.length, 2);
  assert.equal(by("main:A1:0").verdict, "unknown");
  assert.equal(by("main:A1:0").attempts.length, 3);
  assert.equal(by("main:A1:1").verdict, "fail");
  assert.equal(by("main:A2:0").verdict, "fail");
  assert.ok(by("main:A2:0").claimedSuccessButFailed);
  assert.equal(ledger.attempts, 11);
  assert.ok(Math.abs(ledger.spentUsd - (0.1 + 0.5 + 0.3 + 2 + 0.5 * 5)) < 1e-9);
});

test("exhausted provider credit blocks the rest of the phase", async () => {
  const exp = small();
  const script: Record<string, ScriptedAttempt[]> = {};
  const slots = schedule(exp, "main");
  for (const slot of slots) script[slot.key] = [ok(goodFor[slot.arm])];
  script[slots[2].key] = [{ status: "credit_exhausted", costUsd: 0, turns: 0, claim: "none" }];
  const results = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger: newLedger(50) });
  assert.equal(results.filter((r) => r.verdict !== "not_run").length, 2);
  assert.ok(results.slice(2).every((r) => r.verdict === "not_run" && r.reasons.some((x) => x.includes("blocked: provider credit exhausted"))));
});

test("the budget cap stops the run and leaves the rest not run", async () => {
  const exp = small({ budget: { capUsd: 5, confirmed: false } });
  const script: Record<string, ScriptedAttempt[]> = {};
  for (const slot of schedule(exp, "main")) script[slot.key] = [ok(goodFor[slot.arm], 1.5)];
  const ledger = newLedger(exp.budget.capUsd);
  const results = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger });
  assert.equal(results.filter((r) => r.verdict !== "not_run").length, 3, "the 4th attempt could cross the cap at the per-attempt limit");
  assert.ok(ledger.spentUsd <= exp.budget.capUsd);
  const report = buildReport({ label: "offline-simulation", experiment: exp, experimentSha256: sha256, phase: "main", version: { harness: "fake", cliVersion: "offline", model: "none" }, results, ledger });
  assert.equal(report.valid, false);
  assert.equal(report.findingsEligible, false);
});

test("an all-pass vs all-fail main phase is a detected difference; a tie is inconclusive, not equivalent", async () => {
  const exp = base;
  const script: Record<string, ScriptedAttempt[]> = {};
  for (const slot of schedule(exp, "main")) script[slot.key] = [ok(goodFor[slot.arm], 0.01)];
  const ledger = newLedger(50);
  const results = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger });
  const offline = buildReport({ label: "offline-simulation", experiment: exp, experimentSha256: sha256, phase: "main", version: { harness: "fake", cliVersion: "offline", model: "none" }, results, ledger });
  assert.equal(offline.findingsEligible, false, "offline simulations are never findings");
  assert.ok(offline.comparisons.every((c) => c.conclusion === "not analyzed"), "no claims from offline data");
  assert.match(renderMarkdown(offline), /offline simulation: scripted sessions, not agent behavior/);
  const relabeled = buildReport({ label: "live", experiment: exp, experimentSha256: sha256, phase: "main", version: { harness: "fake", cliVersion: "offline", model: "none" }, results, ledger });
  assert.equal(relabeled.findingsEligible, false, "relabeling fake results as live is rejected");
  assert.ok(relabeled.comparisons.every((c) => c.conclusion === "not analyzed"));
  const shared = join(makeTempDir(), "t.jsonl");
  writeFileSync(shared, "{}\n");
  const forged = results.map((r) => ({ ...r, attempts: r.attempts.map((a) => ({ ...a, transcriptPath: shared })) }));
  const forgedReport = buildReport({ label: "live", experiment: exp, experimentSha256: sha256, phase: "main", version: { harness: "claude-code", cliVersion: "test", model: "none" }, results: forged, ledger });
  assert.equal(forgedReport.findingsEligible, false, "a shared {} transcript is rejected");
  assert.ok(forgedReport.validityNotes.some((n) => n.includes("shared with another attempt")));
  const root = makeTempDir();
  const linkedLedger = newLedger(50);
  const linked = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script, { transcriptDir: join(root, "t") }), ledger: linkedLedger, artifactDir: join(root, "a") });
  const report = buildReport({ label: "live", experiment: exp, experimentSha256: sha256, phase: "main", version: { harness: "claude-code", cliVersion: "test", model: "none" }, results: linked, ledger: linkedLedger });
  assert.equal(report.findingsEligible, false, "scripted transcripts relabeled as native are rejected");
  assert.ok(report.validityNotes.some((n) => n.includes("is scripted, not a native session")));
  assert.ok(report.comparisons.every((c) => c.conclusion === "not analyzed"));
  writeFileSync(linked[0].attempts[0].artifact!.path, "tampered");
  const tampered = buildReport({ label: "live", experiment: exp, experimentSha256: sha256, phase: "main", version: { harness: "claude-code", cliVersion: "test", model: "none" }, results: linked, ledger: linkedLedger });
  assert.ok(tampered.validityNotes.some((n) => n.includes("does not match the recorded")));
  const stats = compareArms(exp, report.arms, true);
  const primary = stats.find((c) => c.role === "primary")!;
  assert.match(primary.conclusion, /difference detected/);
  const tie = stats.find((c) => c.a === "A0" && c.b === "A1")!;
  assert.match(tie.conclusion, /exploratory, no claim/);
  assert.deepEqual(report.significanceReference, { n: 10, alpha: 0.05, otherArmMaxPasses: 5 });
  assert.ok(report.runs.every((r) => r.attemptRecords.every((a) => a.verification !== null && a.usage !== undefined && a.artifact)), "every attempt keeps its evidence");
  const md = renderMarkdown(report);
  assert.match(md, /\| A2 \| 10 \| 0 \| 10 \|/);

  const v = { harness: "fake", cliVersion: "offline", model: "none" };
  for (const [name, bad] of [
    ["empty", []],
    ["incomplete", results.slice(1)],
    ["duplicate", [...results.slice(1), results[2]]],
  ] as const) {
    const r = buildReport({ label: "live", experiment: exp, experimentSha256: sha256, phase: "main", version: v, results: [...bad], ledger });
    assert.equal(r.findingsEligible, false, name);
    assert.equal(r.valid, false, name);
    assert.ok(r.comparisons.every((c) => c.conclusion === "not analyzed"), name);
  }
});

test("one ledger shared by concurrent phases never spends past its cap", async () => {
  const exp = small({ budget: { capUsd: 2, confirmed: false }, limits: { ...base.limits, maxCostUsdPerAttempt: 1 } });
  const script: Record<string, ScriptedAttempt[]> = {};
  for (const ph of ["smoke", "main"] as const) for (const slot of schedule(exp, ph)) script[slot.key] = [ok(goodFor[slot.arm], 1)];
  const ledger = newLedger(2);
  const runs = await Promise.all((["smoke", "main"] as const).map((phase) => runPhase({ experiment: exp, caseSpec, phase, adapter: fakeAdapter(FIXTURES, script), ledger, concurrency: 4 })));
  assert.ok(ledger.spentUsd <= 2 + 1e-9, `spent ${ledger.spentUsd}`);
  assert.equal(runs.flat().filter((r) => r.verdict !== "not_run").length, 2);
});

test("an experiment cap stops its own attempts without touching the shared ledger cap", async () => {
  const exp = small({ budget: { capUsd: 50, confirmed: false, experimentCapUsd: 3 } });
  const script: Record<string, ScriptedAttempt[]> = {};
  for (const slot of schedule(exp, "main")) script[slot.key] = [ok(goodFor[slot.arm])];
  const ledger = newLedger(50);
  ledger.charge(ledger.reserve("other", 1, 10, { experiment: "other-experiment" })!, 10);
  const results = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger });
  assert.equal(results.filter((r) => r.verdict !== "not_run").length, 3);
  assert.ok(results.some((r) => r.reasons.includes("budget cap reached")));
  assert.ok(ledger.spentUsdFor(exp.id) <= 3 + 1e-9);
  assert.ok(Math.abs(ledger.spentUsd - 11.5) < 1e-9);
  assert.ok(ledger.snapshot().entries.slice(1).every((e) => e.experiment === exp.id));
  const report = buildReport({ label: "offline-simulation", experiment: exp, experimentSha256: sha256, phase: "main", version: { harness: "fake", cliVersion: "offline", model: "none" }, results, ledger });
  assert.equal(report.budget.experimentCapUsd, 3);
  assert.match(renderMarkdown(report), /This experiment's own cap: 3 USD, charged so far 1\.50 USD/);
  assert.equal(planCost(exp, { low: 0.3, high: 1 }).capUsd, 3);
  const malformed = join(makeTempDir(), "experiment.json");
  writeFileSync(malformed, JSON.stringify({ ...base, budget: { ...base.budget, experimentCapUsd: "5" } }));
  assert.throws(() => loadExperiment(malformed), /not a non-negative number/);
  const unnamed = newLedger(50);
  assert.notEqual(unnamed.reserve("x", 1, 1, { experiment: "", experimentCapUsd: 1 }), null);
  assert.equal(unnamed.reserve("x", 2, 1, { experiment: "", experimentCapUsd: 1 }), null);
});

test("a durable ledger locks out a second runner and carries prior charges", () => {
  const path = join(makeTempDir(), "ledger.json");
  const a = BudgetLedger.open(path, 2);
  assert.throws(() => BudgetLedger.open(path, 2), /locked by another runner/);
  a.charge(a.reserve("x", 1, 1)!, 0.4);
  a.reserve("y", 1, 1);
  a.close();
  const b = BudgetLedger.open(path, 2);
  assert.ok(Math.abs(b.spentUsd - 1.4) < 1e-9, "an open reservation from a dead runner is charged at its cap");
  assert.ok(Math.abs(b.headroomUsd - 0.6) < 1e-9);
  assert.equal(b.reserve("z", 1, 1), null);
  b.close();
  assert.throws(() => BudgetLedger.open(path, 80), /differs/);
});

test("a completed session over its cost or turn limit fails even if the artifact is correct", async () => {
  const exp = small();
  const script: Record<string, ScriptedAttempt[]> = {};
  const slots = schedule(exp, "main");
  for (const slot of slots) script[slot.key] = [ok(goodFor[slot.arm], 0.1)];
  script[slots[0].key] = [ok(goodFor[slots[0].arm], exp.limits.maxCostUsdPerAttempt + 1)];
  script[slots[1].key] = [{ ...ok(goodFor[slots[1].arm], 0.1), turns: exp.limits.maxTurns + 5 }];
  const results = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger: newLedger(50) });
  assert.equal(results[0].verdict, "fail");
  assert.ok(results[0].reasons.some((r) => r.startsWith("over limit: cost")));
  assert.equal(results[1].verdict, "fail");
  assert.ok(results[1].reasons.some((r) => r.startsWith("over limit:") && r.includes("turns")));
});

test("smoke and pilot results are never analyzed as findings", async () => {
  const script: Record<string, ScriptedAttempt[]> = {};
  for (const slot of schedule(base, "smoke")) script[slot.key] = [ok(goodFor[slot.arm])];
  const ledger = newLedger(50);
  const results = await runPhase({ experiment: base, caseSpec, phase: "smoke", adapter: fakeAdapter(FIXTURES, script), ledger });
  const report = buildReport({ label: "live", experiment: base, experimentSha256: sha256, phase: "smoke", version: { harness: "fake", cliVersion: "offline", model: "none" }, results, ledger });
  assert.equal(report.findingsEligible, false);
  assert.ok(report.comparisons.every((c) => c.conclusion === "not analyzed"));
});

test("cost plan counts smoke, pilot, main and retries", () => {
  const plan = planCost(base, { low: 0.3, high: 1 });
  assert.deepEqual(plan.rows.map((r) => r.slots), [4, 8, 40]);
  assert.equal(plan.expectedAttempts, 4 + 1 + 8 + 1 + 40 + 4);
  assert.equal(plan.worstCaseAttempts, 52 * 3);
});

test("an attempt is charged the larger of the reported cost and the lab's token pricing", () => {
  const p = { model: "m", input: 3, output: 15, cacheWrite5m: 3.75, cacheWrite1h: 6, cacheRead: 0.3, source: "test" };
  const usage = { input_tokens: 10, output_tokens: 4000, cache_creation_input_tokens: 6000, cache_read_input_tokens: 100_000 };
  const priced = (10 * 3 + 4000 * 15 + 6000 * 3.75 + 100_000 * 0.3) / 1e6;
  assert.ok(Math.abs((chargeFor(0.06, usage, p) as number) - priced) < 1e-12, "an undercounted report is replaced by the token price");
  assert.equal(chargeFor(5, usage, p), 5, "a higher report is kept");
  assert.ok(Math.abs((chargeFor("unknown", usage, p) as number) - priced) < 1e-12);
  assert.equal(chargeFor("unknown", null, p), "unknown");
});

test("retryOn: [] disables retries", async () => {
  const exp = small({ retries: { maxRetriesPerSlot: 2, retryOn: [] } });
  const script: Record<string, ScriptedAttempt[]> = {};
  const slots = schedule(exp, "main");
  for (const slot of slots) script[slot.key] = [{ status: "harness_error", costUsd: 0.01, turns: 0, claim: "none" }, ok(goodFor[slot.arm])];
  const results = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger: newLedger(50) });
  assert.ok(results.every((r) => r.attempts.length === 1 && r.verdict === "unknown"));
});

test("every attempt is reported as soon as it ends", async () => {
  const exp = small();
  const script: Record<string, ScriptedAttempt[]> = {};
  const slots = schedule(exp, "main");
  for (const slot of slots) script[slot.key] = [{ status: "harness_error", costUsd: 0.01, turns: 0, claim: "none" }, ok(goodFor[slot.arm])];
  const seen: string[] = [];
  await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger: newLedger(50), onAttempt: (k, a, stage) => { if (stage === "terminal") seen.push(`${k}#${a.attempt}`); } });
  assert.equal(seen.length, slots.length * 2);
  assert.ok(slots.every((s) => seen.includes(`${s.key}#1`) && seen.includes(`${s.key}#2`)));
});

test("a phase is re-verified from a different checkout of its evidence", async () => {
  const exp = small();
  const script: Record<string, ScriptedAttempt[]> = {};
  const slots = schedule(exp, "main");
  for (const slot of slots) script[slot.key] = [ok(goodFor[slot.arm])];
  const original = makeTempDir();
  await runPhase({
    experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script, { transcriptDir: join(original, "transcripts") }), ledger: newLedger(50), artifactDir: join(original, "artifacts"),
    onAttempt: (slot, a, stage) => appendFileSync(join(original, "attempts.jsonl"), JSON.stringify({ slot, stage, ...a }) + "\n"),
  });
  const moved = join(makeTempDir(), "main");
  cpSync(original, moved, { recursive: true });
  rmSync(original, { recursive: true, force: true });
  const entries = reverifyAttempts({ attemptsLog: join(moved, "attempts.jsonl"), caseSpec, checksSha256: exp.checksSha256, runner: hostRunner });
  assert.equal(entries.length, slots.length);
  assert.ok(entries.every((e) => e.match === true && e.problems.length === 0), JSON.stringify(entries));
});

test("an interrupted phase is re-verified from retained snapshots after its workspaces are gone", async () => {
  const exp = small();
  const script: Record<string, ScriptedAttempt[]> = {};
  const slots = schedule(exp, "main");
  for (const slot of slots) script[slot.key] = [ok(goodFor[slot.arm])];
  script[slots[1].key] = [ok("divide-by-100")];
  const root = makeTempDir();
  const log = join(root, "attempts.jsonl");
  const workdirs: string[] = [];
  const adapter = fakeAdapter(FIXTURES, script, { transcriptDir: join(root, "t") });
  const run = adapter.run.bind(adapter);
  adapter.run = (req) => { workdirs.push(req.workdir); return run(req); };
  const results = await runPhase({
    experiment: exp, caseSpec, phase: "main", adapter, ledger: newLedger(50), artifactDir: join(root, "a"),
    onAttempt: (slot, a, stage) => appendFileSync(log, JSON.stringify({ slot, stage, ...a }) + "\n"),
  });
  assert.ok(workdirs.every((d) => !existsSync(d)), "temporary workspaces are removed");
  const lines = readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.ok(lines.filter((l) => l.stage === "terminal").every((l) => l.verification !== null), "terminal records carry the verifier result");
  const interrupted = lines.filter((l) => !(l.slot === slots[0].key && l.stage === "terminal"));
  writeFileSync(log, interrupted.map((l) => JSON.stringify(l)).join("\n") + "\n");
  const entries = reverifyAttempts({ attemptsLog: log, caseSpec, checksSha256: exp.checksSha256, runner: hostRunner });
  assert.equal(entries.length, slots.length);
  for (const e of entries) {
    const original = results.find((r) => r.slot.key === e.slot)!;
    assert.equal(e.reverifiedVerdict, original.verdict, e.slot);
    if (e.slot === slots[0].key) {
      assert.equal(e.recordedVerdict, null);
      assert.ok(e.problems.includes("interrupted before its terminal record"));
    } else assert.equal(e.match, true);
  }
  assert.ok(entries.some((e) => e.reverifiedVerdict === "fail"), "a broken candidate still fails on reverification");
});

test("reservations held by running sessions delay admission instead of stopping the phase", async () => {
  const exp = small({ budget: { capUsd: 5, confirmed: false } });
  const script: Record<string, ScriptedAttempt[]> = {};
  for (const slot of schedule(exp, "main")) script[slot.key] = [ok(goodFor[slot.arm], 0.5)];
  const ledger = newLedger(exp.budget.capUsd);
  const results = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger, concurrency: 3 });
  assert.equal(results.filter((r) => r.verdict === "not_run").length, 1, "only the slot that the remaining headroom cannot fund is left");
  assert.ok(Math.abs(ledger.spentUsd - 3.5) < 1e-9);
});

test("a failed artifact snapshot keeps the charged attempt and its verdict", async () => {
  const exp = small();
  const script: Record<string, ScriptedAttempt[]> = {};
  for (const slot of schedule(exp, "main")) script[slot.key] = [ok(goodFor[slot.arm])];
  const artifactDir = makeTempDir();
  writeFileSync(join(artifactDir, "main_A0_0_attempt1.tar"), "");
  const seen: string[] = [];
  const results = await runPhase({ experiment: exp, caseSpec, phase: "main", adapter: fakeAdapter(FIXTURES, script), ledger: newLedger(50), artifactDir, onAttempt: (k, _a, stage) => seen.push(`${k}:${stage}`) });
  const slot = results.find((r) => r.slot.key === "main:A0:0")!;
  assert.equal(slot.verdict, "pass");
  assert.equal(slot.attempts.length, 1);
  assert.match(slot.attempts[0].artifactError ?? "", /already exists.*workspace kept at /);
  assert.ok(existsSync((slot.attempts[0].artifactError ?? "").split("workspace kept at ")[1]));
  assert.ok(seen.includes("main:A0:0:session") && seen.includes("main:A0:0:terminal"));
});

test("disabled retries add no expected or worst-case attempts", () => {
  const plan = planCost({ ...base, retries: { ...base.retries, maxRetriesPerSlot: 0 } }, { low: 0.3, high: 1 });
  assert.equal(plan.expectedAttempts, 52);
  assert.equal(plan.worstCaseAttempts, 52);
  const none = planCost({ ...base, retries: { ...base.retries, retryOn: [] } }, { low: 0.3, high: 1 });
  assert.equal(none.expectedAttempts, 52);
  assert.equal(none.worstCaseAttempts, 52);
});

test("an experiment with a repeated arm is rejected before any spend", () => {
  const path = join(makeTempDir(), "dup.json");
  writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(EXPERIMENT, "utf8")), arms: ["A0", "A0"] }));
  assert.throws(() => loadExperiment(path), /arms must be unique/);
});

test("a ledger lock left by a dead runner is recovered", () => {
  const path = join(makeTempDir(), "ledger.json");
  writeFileSync(`${path}.lock`, "999999999");
  const ledger = BudgetLedger.open(path, 2);
  assert.equal(readFileSync(`${path}.lock`, "utf8"), String(process.pid));
  ledger.close();
});

test("a truncated attempts log line is reported, not thrown", () => {
  const log = join(makeTempDir(), "attempts.jsonl");
  writeFileSync(log, '{"slot":"main:A0:0"');
  const entries = reverifyAttempts({ attemptsLog: log, caseSpec, checksSha256: base.checksSha256, runner: hostRunner });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].artifactOk, false);
  assert.match(entries[0].problems[0], /not JSON/);
});

test("two runners recovering the same dead lock never both hold it", () => {
  const path = join(makeTempDir(), "ledger.json");
  writeFileSync(`${path}.lock`, "999999999");
  writeFileSync(`${path}.lock.recovery`, "");
  assert.throws(() => BudgetLedger.open(path, 2), /locked by another runner/);
  rmSync(`${path}.lock.recovery`);
  const first = BudgetLedger.open(path, 2);
  assert.throws(() => BudgetLedger.open(path, 2), /locked by another runner/);
  first.close();
});
