#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const USAGE = `dead-rules.mjs: plan, rehearse, budget and report for an instruction experiment.

  node dead-rules.mjs plan --runs 10 [--arms 3] [--cost-per-run 0.08] [--cap 5]
  node dead-rules.mjs rehearse --good <dir>[,<dir>] --bad <dir>[,<dir>] -- <verifier command with {dir}>
  node dead-rules.mjs budget --experiment experiment.json --results results-smoke.jsonl,results-pilot.jsonl,results.jsonl --next-cost 0.10
  node dead-rules.mjs report --experiment experiment.json --results results.jsonl

Node.js 18 or later, standard library only. Exit code 1 means the check failed.
A verifier exits 0 for correct work, 1 for wrong work, and anything else when it broke.`;

const VERDICTS = ["pass", "fail", "unknown", "not_run"];
const Z95 = 1.959963984540054;

function parseArgs(argv) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { rest.push(...argv.slice(i + 1)); break; }
    if (a.startsWith("--")) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail(`${a} needs a value`);
      opts[a.slice(2)] = value;
      i++;
    }
    else rest.push(a);
  }
  return { opts, rest };
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(2);
}

function need(opts, key) {
  if (opts[key] === undefined) fail(`--${key} is required\n\n${USAGE}`);
  return opts[key];
}

function positiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) fail(`--${name} must be a whole number of 1 or more`);
  return n;
}

function money(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) fail(`--${name} must be a dollar amount of 0 or more`);
  return n;
}

const logFactorials = [0];
function logFactorial(n) {
  for (let i = logFactorials.length; i <= n; i++) logFactorials[i] = logFactorials[i - 1] + Math.log(i);
  return logFactorials[n];
}

function logChoose(n, k) {
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

export function fisherTwoSided(passA, nA, passB, nB) {
  const passes = passA + passB;
  const total = nA + nB;
  const prob = (x) => Math.exp(logChoose(nA, x) + logChoose(nB, passes - x) - logChoose(total, passes));
  const observed = prob(passA);
  let p = 0;
  for (let x = Math.max(0, passes - nB); x <= Math.min(nA, passes); x++) {
    const px = prob(x);
    if (px <= observed * (1 + 1e-7)) p += px;
  }
  return Math.min(1, p);
}

export function wilson(passes, n) {
  if (n === 0) return [0, 1];
  const phat = passes / n;
  const z2 = Z95 * Z95;
  const centre = (phat + z2 / (2 * n)) / (1 + z2 / n);
  const half = (Z95 * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

const fits = (spend, cap) => spend <= cap + 1e-9;
const pct = (x) => `${Math.round(x * 100)}%`;
const usd = (x) => `$${x.toFixed(2)}`;

function plan(opts) {
  const runs = positiveInt(need(opts, "runs"), "runs");
  const arms = opts.arms === undefined ? 2 : positiveInt(opts.arms, "arms");
  if (arms < 2) fail("an experiment needs at least two arms");
  const lines = [`# Plan: ${runs} runs per arm, ${arms} arms`, "", "| Control passes | Treatment must pass at most | or at least |", "|---|---|---|"];
  for (let c = 0; c <= runs; c++) {
    let low = null;
    let high = null;
    for (let t = 0; t <= runs; t++) {
      if (fisherTwoSided(c, runs, t, runs) < 0.05) {
        if (t < c) low = t;
        else if (high === null && t > c) high = t;
      }
    }
    lines.push(`| ${c}/${runs} | ${low === null ? "none" : `${low}/${runs}`} | ${high === null ? "none" : `${high}/${runs}`} |`);
  }
  lines.push("", "A difference smaller than the table shows comes back inconclusive. Inconclusive never means the arms are equivalent.");
  let ok = true;
  if (opts["cost-per-run"] !== undefined) {
    const each = money(opts["cost-per-run"], "cost-per-run");
    const total = each * (runs + 3) * arms;
    lines.push("", `Estimated cost: ${(runs + 3) * arms} runs (smoke 1, pilot 2 and main ${runs} per arm, ${arms} arms) at ${usd(each)} = ${usd(total)}.`);
    if (opts.cap !== undefined) {
      const cap = money(opts.cap, "cap");
      ok = fits(total, cap);
      lines.push(ok ? `Within the ${usd(cap)} cap.` : `Over the ${usd(cap)} cap: lower the runs or raise the cap with the owner's approval.`);
    }
  }
  console.log(lines.join("\n"));
  return ok ? 0 : 1;
}

function rehearse(opts, command) {
  if (command.length === 0 || !command.some((part) => part.includes("{dir}"))) fail("give the verifier after --, with {dir} where the candidate folder goes");
  const split = (value) => (value ? String(value).split(",").filter(Boolean) : []);
  const cases = [...split(opts.good).map((dir) => ({ dir, expect: "pass" })), ...split(opts.bad).map((dir) => ({ dir, expect: "fail" }))];
  if (!cases.some((c) => c.expect === "pass") || !cases.some((c) => c.expect === "fail")) fail("rehearsal needs at least one --good and one --bad fixture");
  const lines = ["| Fixture | Expected | Verifier said | Result | Verifier output |", "|---|---|---|---|---|"];
  let mismatches = 0;
  for (const c of cases) {
    const args = command.map((part) => part.replaceAll("{dir}", c.dir));
    const run = spawnSync(args[0], args.slice(1), { encoding: "utf8", timeout: 120000 });
    const reason = (run.stdout ?? "").trim();
    const said = run.error ? `error: ${run.error.message}` : run.status === 0 ? "pass" : run.status !== 1 ? `error: ${run.signal ?? `exit ${run.status}`}` : reason ? "fail" : "error: exit 1 with no reason on stdout";
    const ok = said === c.expect;
    if (!ok) mismatches++;
    const firstLine = ((run.stdout ?? "").trim() || (run.stderr ?? "").trim()).split(/\r?\n/)[0];
    lines.push(`| ${c.dir} | ${c.expect} | ${said} | ${ok ? "ok" : "MISMATCH"} | ${firstLine.replaceAll("|", "\\|").slice(0, 120)} |`);
  }
  lines.push("", mismatches === 0 ? "Verifier rehearsal passed: every fixture got the expected verdict. Check that each bad fixture's output names the mistake it replays." : `Verifier rehearsal failed: ${mismatches} fixture(s) got the wrong verdict or broke the verifier. Fix the verifier before any paid run.`);
  console.log(lines.join("\n"));
  return mismatches === 0 ? 0 : 1;
}

function loadExperiment(path) {
  let exp;
  try { exp = JSON.parse(readFileSync(path, "utf8")); } catch (e) { fail(`cannot read experiment ${path}: ${e.message}`); }
  const problems = [];
  if (!Array.isArray(exp.arms) || exp.arms.length < 2) problems.push("arms must list at least two arm ids");
  if (!Number.isInteger(exp.runsPerArm) || exp.runsPerArm < 1) problems.push("runsPerArm must be a whole number of 1 or more");
  const comparisons = Array.isArray(exp.comparisons) ? exp.comparisons : [];
  if (comparisons.filter((c) => c.role === "primary").length !== 1) problems.push("comparisons must hold exactly one with role primary");
  for (const c of comparisons) if (!exp.arms?.includes(c.a) || !exp.arms?.includes(c.b)) problems.push(`comparison ${c.a} vs ${c.b} names an arm that is not in arms`);
  if (!(exp.budget && Number.isFinite(exp.budget.capUsd))) problems.push("budget.capUsd must be a number");
  if (problems.length) fail(`experiment ${path}:\n- ${problems.join("\n- ")}`);
  return { ...exp, comparisons, invalidIfUnresolvedShareAbove: exp.invalidIfUnresolvedShareAbove ?? 0.1 };
}

function loadResults(path, { missingIsEmpty = false } = {}) {
  if (missingIsEmpty && !existsSync(path)) return [];
  let text;
  try { text = readFileSync(path, "utf8"); } catch (e) { fail(`cannot read results ${path}: ${e.message}`); }
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line, i) => {
    let row;
    try { row = JSON.parse(line); } catch { fail(`${path}:${i + 1}: not valid JSON`); }
    if (!VERDICTS.includes(row.verdict)) fail(`${path}:${i + 1}: verdict must be one of ${VERDICTS.join(", ")}`);
    if (typeof row.arm !== "string" || !Number.isInteger(row.run)) fail(`${path}:${i + 1}: needs a string arm and a whole-number run`);
    const costOk = typeof row.costUsd === "number" && Number.isFinite(row.costUsd) && row.costUsd >= 0;
    if ((row.verdict !== "not_run" || row.costUsd !== undefined) && !costOk) fail(`${path}:${i + 1}: needs costUsd, a number of dollars; use the most a run can cost when the harness gives no figure`);
    return { ...row, costUsd: row.costUsd ?? 0 };
  });
}

const spent = (results) => results.reduce((sum, r) => sum + r.costUsd, 0);

function budget(opts) {
  const exp = loadExperiment(need(opts, "experiment"));
  const results = String(need(opts, "results")).split(",").filter(Boolean).flatMap((path) => loadResults(path, { missingIsEmpty: true }));
  const next = money(need(opts, "next-cost"), "next-cost");
  const total = spent(results);
  const ok = fits(total + next, exp.budget.capUsd);
  console.log(`${usd(total)} spent of the ${usd(exp.budget.capUsd)} cap. The next run, at up to ${usd(next)}, ${ok ? "fits" : "could cross the cap: stop and mark the remaining runs not_run"}.`);
  return ok ? 0 : 1;
}

function report(opts) {
  const exp = loadExperiment(need(opts, "experiment"));
  const results = loadResults(need(opts, "results"));
  const expected = new Set(exp.arms.flatMap((arm) => Array.from({ length: exp.runsPerArm }, (_, i) => `${arm}:${i}`)));
  const seen = new Map();
  for (const r of results) seen.set(`${r.arm}:${r.run}`, (seen.get(`${r.arm}:${r.run}`) ?? 0) + 1);
  const missing = [...expected].filter((k) => !seen.has(k));
  const duplicated = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  const unexpected = [...seen.keys()].filter((k) => !expected.has(k));
  const unresolved = results.filter((r) => r.verdict === "unknown" || r.verdict === "not_run").length;
  const share = results.length ? unresolved / results.length : 1;
  const notes = [];
  if (missing.length || duplicated.length || unexpected.length) notes.push(`results do not match the ${expected.size}-run plan: ${missing.length} missing, ${duplicated.length} duplicated, ${unexpected.length} unexpected`);
  if (results.length === 0) notes.push("the results file has no runs");
  else if (share > exp.invalidIfUnresolvedShareAbove) notes.push(`${unresolved}/${results.length} runs unknown or not run, above the ${pct(exp.invalidIfUnresolvedShareAbove)} limit`);
  const valid = notes.length === 0;

  const stats = new Map(exp.arms.map((arm) => {
    const rows = results.filter((r) => r.arm === arm);
    const count = (v) => rows.filter((r) => r.verdict === v).length;
    const resolved = count("pass") + count("fail");
    return [arm, { rows, pass: count("pass"), fail: count("fail"), unknown: count("unknown"), notRun: count("not_run"), resolved, cost: spent(rows), cleanFail: rows.filter((r) => r.verdict === "fail" && r.endedNormally === true).length }];
  }));

  const out = [`# ${exp.id ?? "experiment"}: report`, "", `Valid: **${valid ? "yes" : "no"}**.${valid ? "" : ` ${notes.join("; ")}. No comparison below supports a claim.`}`, "", "## Arms", "",
    "| Arm | Runs | Pass | Fail | Unknown | Not run | Pass rate | 95% Wilson | Cost | Ended normally, failed |", "|---|---|---|---|---|---|---|---|---|---|"];
  for (const [arm, s] of stats) {
    const [lo, hi] = wilson(s.pass, s.resolved);
    out.push(`| ${arm} | ${s.rows.length} | ${s.pass} | ${s.fail} | ${s.unknown} | ${s.notRun} | ${s.resolved ? pct(s.pass / s.resolved) : "n/a"} | ${s.resolved ? `${pct(lo)} to ${pct(hi)}` : "n/a"} | ${usd(s.cost)} | ${s.cleanFail} |`);
  }
  out.push("", "Pass rates count only pass and fail runs. Unknown and not run are listed, never counted as either.", "", "## Comparisons", "");
  for (const c of exp.comparisons) {
    const a = stats.get(c.a);
    const b = stats.get(c.b);
    const p = fisherTwoSided(a.pass, a.resolved, b.pass, b.resolved);
    const label = `**${c.role}** ${c.a} vs ${c.b}${c.question ? `: ${c.question}` : ""}`;
    let verdict;
    if (c.role !== "primary") verdict = `exploratory, no claim (p=${p.toFixed(3)})`;
    else if (!valid) verdict = `no claim: the report is invalid (p=${p.toFixed(3)})`;
    else if (p < 0.05) verdict = `difference detected (p=${p.toFixed(3)}): ${c.a} ${a.pass}/${a.resolved}, ${c.b} ${b.pass}/${b.resolved}`;
    else verdict = `inconclusive: no difference detected at this size (p=${p.toFixed(3)}). This does not show the arms are equivalent`;
    out.push(`- ${label} ${verdict}.`);
  }
  const groups = new Map();
  for (const r of results.filter((x) => x.verdict !== "pass")) {
    const key = `${r.verdict}: ${r.reason || "no reason recorded"}`;
    groups.set(key, [...(groups.get(key) ?? []), `${r.arm}#${r.run}`]);
  }
  const reasons = [...groups].sort((x, y) => y[1].length - x[1].length).map(([key, runs]) => `- ${runs.length} run${runs.length === 1 ? "" : "s"} ${key} (${runs.sort((x, y) => x.localeCompare(y, "en", { numeric: true })).join(", ")})`);
  out.push("", "## Cost", "", `${usd(spent(results))} for the runs in this file. \`budget\` with every phase's results file gives the experiment total against the ${usd(exp.budget.capUsd)} cap. Compare it with the provider's usage page before the next paid run.`);
  out.push("", "## Failures", "", ...(reasons.length ? reasons : ["- none recorded"]));
  console.log(out.join("\n"));
  return valid ? 0 : 1;
}

const COMMANDS = { plan, rehearse, budget, report };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [name, ...argv] = process.argv.slice(2);
  const command = COMMANDS[name];
  if (!command) { console.log(USAGE); process.exit(name ? 2 : 0); }
  const { opts, rest } = parseArgs(argv);
  process.exit(command(opts, rest));
}
