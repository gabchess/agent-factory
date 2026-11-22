import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fisherTwoSided, wilson } from "../scripts/crashlab.mjs";

const SCRIPT = new URL("../scripts/crashlab.mjs", import.meta.url);

function isolatedScript() {
  const dir = mkdtempSync(join(tmpdir(), "crashlab-alone-"));
  const path = join(dir, "crashlab.mjs");
  copyFileSync(SCRIPT, path);
  return path;
}

function run(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function lab(arms) {
  const dir = mkdtempSync(join(tmpdir(), "crashlab-lab-"));
  writeFileSync(join(dir, "experiment.json"), JSON.stringify({
    id: "replay",
    arms: Object.keys(arms),
    runsPerArm: 10,
    invalidIfUnresolvedShareAbove: 0.1,
    budget: { capUsd: 5 },
    comparisons: [{ a: "E0", b: "E1", role: "primary" }, { a: "E0", b: "E2", role: "exploratory" }],
  }));
  const lines = [];
  for (const [arm, passes] of Object.entries(arms)) {
    for (let run = 0; run < 10; run++) {
      lines.push(JSON.stringify({ arm, run, verdict: run < passes ? "pass" : "fail", costUsd: 0.074, endedNormally: true, reason: run < passes ? "" : "Q-09 off by one cent" }));
    }
  }
  writeFileSync(join(dir, "results.jsonl"), lines.join("\n") + "\n");
  return dir;
}

test("fisher matches known two-sided values", () => {
  assert.equal(fisherTwoSided(0, 10, 1, 10), 1);
  assert.ok(Math.abs(fisherTwoSided(10, 10, 5, 10) - 0.0325) < 0.0001);
  assert.ok(fisherTwoSided(10, 10, 6, 10) > 0.05);
  assert.ok(Math.abs(fisherTwoSided(0, 10, 10, 10) - 1.0825e-5) < 1e-8);
});

test("wilson matches the lab's intervals", () => {
  const round = ([lo, hi]) => [Math.round(lo * 100), Math.round(hi * 100)];
  assert.deepEqual(round(wilson(0, 10)), [0, 28]);
  assert.deepEqual(round(wilson(1, 10)), [2, 40]);
  assert.deepEqual(round(wilson(10, 10)), [72, 100]);
});

test("report reproduces the excuse-contagion main phase from a lone copy", () => {
  const dir = lab({ E0: 0, E1: 1, E2: 10 });
  const r = run(isolatedScript(), ["report", "--experiment", "experiment.json", "--results", "results.jsonl"], dir);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Valid: \*\*yes\*\*/);
  assert.match(r.out, /\| E0 \| 10 \| 0 \| 10 \| 0 \| 0 \| 0% \| 0% to 28% \|/);
  assert.match(r.out, /\| E2 \| 10 \| 10 \| 0 \| 0 \| 0 \| 100% \| 72% to 100% \|/);
  assert.match(r.out, /inconclusive: no difference detected at this size \(p=1\.000\)\. This does not show the arms are equivalent/);
  assert.match(r.out, /exploratory, no claim/);
});

test("report is invalid when runs are missing or unresolved", () => {
  const dir = lab({ E0: 0, E1: 1, E2: 10 });
  writeFileSync(join(dir, "results.jsonl"), [
    { arm: "E0", run: 0, verdict: "unknown", costUsd: 0 },
    { arm: "E1", run: 0, verdict: "pass", costUsd: 0 },
    { arm: "E1", run: 0, verdict: "pass", costUsd: 0 },
  ].map((x) => JSON.stringify(x)).join("\n"));
  const r = run(isolatedScript(), ["report", "--experiment", "experiment.json", "--results", "results.jsonl"], dir);
  assert.equal(r.code, 1);
  assert.match(r.out, /Valid: \*\*no\*\*/);
  assert.match(r.out, /1 duplicated/);
  assert.match(r.out, /no claim: the report is invalid/);
});

test("budget refuses a run that could cross the cap", () => {
  const dir = lab({ E0: 0, E1: 1, E2: 10 });
  const script = isolatedScript();
  assert.equal(run(script, ["budget", "--experiment", "experiment.json", "--results", "results.jsonl", "--next-cost", "0.5"], dir).code, 0);
  const over = run(script, ["budget", "--experiment", "experiment.json", "--results", "results.jsonl", "--next-cost", "3"], dir);
  assert.equal(over.code, 1);
  assert.match(over.out, /could cross the cap/);
});

test("plan flags a cost over the cap", () => {
  const script = isolatedScript();
  const ok = run(script, ["plan", "--runs", "10", "--arms", "3", "--cost-per-run", "0.08", "--cap", "5"]);
  assert.equal(ok.code, 0);
  assert.match(ok.out, /\| 10\/10 \| 5\/10 \| none \|/);
  assert.equal(run(script, ["plan", "--runs", "10", "--arms", "3", "--cost-per-run", "1", "--cap", "5"]).code, 1);
});

test("rehearse fails when a bad fixture passes the verifier", () => {
  const dir = mkdtempSync(join(tmpdir(), "crashlab-fixtures-"));
  for (const name of ["good", "bad", "sneaky"]) mkdirSync(join(dir, name));
  writeFileSync(join(dir, "good", "ok"), "");
  writeFileSync(join(dir, "sneaky", "ok"), "");
  const verifier = ["--", process.execPath, "-e", "if (require('fs').existsSync(process.argv[1] + '/ok')) process.exit(0); console.log('no ok file'); process.exit(1)", "{dir}"];
  const script = isolatedScript();
  const clean = run(script, ["rehearse", "--good", "good", "--bad", "bad", ...verifier], dir);
  assert.equal(clean.code, 0, clean.out + clean.err);
  const caught = run(script, ["rehearse", "--good", "good", "--bad", "bad,sneaky", ...verifier], dir);
  assert.equal(caught.code, 1);
  assert.match(caught.out, /\| sneaky \| fail \| pass \| MISMATCH \|/);
  assert.match(clean.out, /\| bad \| fail \| fail \| ok \| no ok file \|/);
});

test("rehearse counts a missing verifier as broken, not as a caught mistake", () => {
  const dir = mkdtempSync(join(tmpdir(), "crashlab-missing-"));
  for (const name of ["good", "bad"]) mkdirSync(join(dir, name));
  const r = run(isolatedScript(), ["rehearse", "--good", "good", "--bad", "bad", "--", process.execPath, "verify/missing.mjs", "{dir}"], dir);
  assert.equal(r.code, 1);
  assert.match(r.out, /\| bad \| fail \| error: exit 1 with no reason on stdout \| MISMATCH \|/);
});

test("a results line without a cost is refused", () => {
  const dir = lab({ E0: 0, E1: 1, E2: 10 });
  writeFileSync(join(dir, "results.jsonl"), JSON.stringify({ arm: "E0", run: 0, verdict: "pass" }) + "\n");
  const r = run(isolatedScript(), ["budget", "--experiment", "experiment.json", "--results", "results.jsonl", "--next-cost", "0.1"], dir);
  assert.equal(r.code, 2);
  assert.match(r.err, /needs costUsd/);
});

test("budget treats a results file not written yet as empty and sums every phase", () => {
  const dir = lab({ E0: 0, E1: 1, E2: 10 });
  const script = isolatedScript();
  const fresh = run(script, ["budget", "--experiment", "experiment.json", "--results", "results-smoke.jsonl,results-pilot.jsonl", "--next-cost", "0.1"], dir);
  assert.equal(fresh.code, 0, fresh.err);
  assert.match(fresh.out, /\$0\.00 spent/);
  writeFileSync(join(dir, "results-smoke.jsonl"), JSON.stringify({ arm: "E0", run: 0, verdict: "pass", costUsd: 2.5 }) + "\n");
  assert.equal(run(script, ["budget", "--experiment", "experiment.json", "--results", "results-smoke.jsonl,results.jsonl", "--next-cost", "0.5"], dir).code, 1);
});

test("budget and plan accept a run that exactly fills the cap", () => {
  const dir = lab({ E0: 0, E1: 1, E2: 10 });
  writeFileSync(join(dir, "results.jsonl"), [0.1, 0.2].map((costUsd, run) => JSON.stringify({ arm: "E0", run, verdict: "pass", costUsd })).join("\n"));
  writeFileSync(join(dir, "experiment.json"), JSON.stringify({ id: "x", arms: ["E0", "E1"], runsPerArm: 1, budget: { capUsd: 0.6 }, comparisons: [{ a: "E0", b: "E1", role: "primary" }] }));
  const script = isolatedScript();
  assert.equal(run(script, ["budget", "--experiment", "experiment.json", "--results", "results.jsonl", "--next-cost", "0.3"], dir).code, 0);
  assert.equal(run(script, ["plan", "--runs", "3", "--arms", "2", "--cost-per-run", "0.05", "--cap", "0.6"]).code, 0);
});

test("rehearse counts a crashing verifier as broken, not as a caught mistake", () => {
  const dir = mkdtempSync(join(tmpdir(), "crashlab-crash-"));
  for (const name of ["good", "bad"]) mkdirSync(join(dir, name));
  writeFileSync(join(dir, "good", "ok"), "");
  const verifier = ["--", process.execPath, "-e", "const fs = require('fs'); if (fs.existsSync(process.argv[1] + '/ok')) process.exit(0); process.exit(3)", "{dir}"];
  const r = run(isolatedScript(), ["rehearse", "--good", "good", "--bad", "bad", ...verifier], dir);
  assert.equal(r.code, 1);
  assert.match(r.out, /\| bad \| fail \| error: exit 3 \| MISMATCH \|/);
});

test("budget and plan refuse spend a fraction of a cent over the cap", () => {
  const dir = lab({ E0: 0, E1: 1, E2: 10 });
  writeFileSync(join(dir, "results.jsonl"), JSON.stringify({ arm: "E0", run: 0, verdict: "pass", costUsd: 0.004 }) + "\n");
  writeFileSync(join(dir, "experiment.json"), JSON.stringify({ id: "x", arms: ["E0", "E1"], runsPerArm: 1, budget: { capUsd: 0.01 }, comparisons: [{ a: "E0", b: "E1", role: "primary" }] }));
  const script = isolatedScript();
  assert.equal(run(script, ["budget", "--experiment", "experiment.json", "--results", "results.jsonl", "--next-cost", "0.0064"], dir).code, 1);
  assert.equal(run(script, ["plan", "--runs", "10", "--arms", "3", "--cost-per-run", "0.074", "--cap", "2.1"]).code, 1);
});
