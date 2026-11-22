#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { claudeCodeAdapter } from "../adapters/claude-code.ts";
import { buildReport, renderMarkdown } from "../evidence-reporting/report.ts";
import { runPhase } from "../session-execution/runner.ts";
import { freezeManifest, runPaths } from "../session-execution/run-manifest.ts";
import { BudgetLedger } from "../session-execution/ledger.ts";
import { dockerRunner, ensureEgress, ensureImage } from "../session-execution/sandbox.ts";
import { loadingProbe } from "../session-execution/loading-probe.ts";
import { probeSandbox, renderProbe } from "../session-execution/sandbox-probe.ts";
import { dirname, join, resolve } from "node:path";
import { reverifyAttempts } from "../artifact-verification/reverify.ts";
import { SANDBOX_IMAGE } from "../session-execution/sandbox.ts";
import { buildArm } from "../experiment-design/arms.ts";
import { loadCase } from "../experiment-design/case.ts";
import { auditArm } from "../experiment-design/contamination.ts";
import { loadExperiment, planCost, type Phase } from "../experiment-design/experiment.ts";
import { inventoryClaudeCode } from "../instruction-context/inventory.ts";
import { verifyCandidate } from "../artifact-verification/verify.ts";
import { applyFixture, loadFixture } from "../adapters/fake.ts";
import { sha256File } from "../util/fs.ts";
import { hostRunner } from "../util/proc.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const caseDir = (id: string): string => join(ROOT, "cases", id);
const fixturesDir = (id: string): string => join(ROOT, "fixtures", "candidates", id);
const DEFAULT_CASE = "legacy-cents";
const DEFAULT_EXPERIMENT = `experiments/${DEFAULT_CASE}.json`;

function arg(args: string[], name: string, fallback?: string): string {
  const i = args.indexOf(`--${name}`);
  const v = i >= 0 ? args[i + 1] : fallback;
  if (v === undefined) throw new Error(`missing --${name}`);
  return v;
}

const commands: Record<string, (args: string[]) => number> = {
  reverify(args) {
    const phaseDir = resolve(arg(args, "run"));
    const { spec: experiment } = loadExperiment(resolve(arg(args, "experiment", DEFAULT_EXPERIMENT)));
    const caseSpec = loadCase(caseDir(experiment.case));
    const entries = reverifyAttempts({ attemptsLog: join(phaseDir, "attempts.jsonl"), caseSpec, checksSha256: experiment.checksSha256, runner: args.includes("--host") ? hostRunner : dockerRunner });
    const out = join(phaseDir, `reverify-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(out, JSON.stringify(entries, null, 2));
    for (const e of entries) console.log(`${e.slot}#${e.attempt} ${e.status} recorded=${e.recordedVerdict ?? "none"} reverified=${e.reverifiedVerdict ?? "-"} ${e.match === false ? "MISMATCH " : ""}${e.problems.join("; ")}`);
    console.log(`wrote ${out}`);
    return entries.some((e) => e.match === false || !e.artifactOk) ? 1 : 0;
  },
  build(args) {
    const spec = loadCase(caseDir(arg(args, "case", DEFAULT_CASE)));
    const out = resolve(arg(args, "out"));
    mkdirSync(out, { recursive: true });
    for (const arm of spec.arms) {
      const built = buildArm(spec, arm.id, join(out, arm.id));
      console.log(`${arm.id} ${arm.name}: commit ${built.commit} tree ${built.treeHash.slice(0, 12)} -> ${built.dir}`);
    }
    return 0;
  },
  audit(args) {
    const spec = loadCase(caseDir(arg(args, "case", DEFAULT_CASE)));
    let ok = true;
    for (const arm of spec.arms) {
      const report = auditArm(spec, arm.id, buildArm(spec, arm.id).dir);
      ok &&= report.ok;
      console.log(`${arm.id} ${report.ok ? "clean" : "CONTAMINATED"}`);
      for (const f of report.findings) console.log(`  ${f.severity} ${f.check} ${f.where}: ${f.detail}`);
    }
    return ok ? 0 : 1;
  },
  inventory(args) {
    console.log(JSON.stringify(inventoryClaudeCode(resolve(arg(args, "repo")), { home: arg(args, "home", "") || undefined }), null, 2));
    return 0;
  },
  verify(args) {
    const spec = loadCase(caseDir(arg(args, "case", DEFAULT_CASE)));
    const armDir = buildArm(spec, arg(args, "arm")).dir;
    const result = verifyCandidate({ spec, armDir, candidateDir: resolve(arg(args, "candidate")), expectedChecksSha256: sha256File(spec.heldOutPath), runner: args.includes("--host") ? hostRunner : dockerRunner });
    console.log(JSON.stringify(result, null, 2));
    return result.verdict === "pass" ? 0 : 1;
  },
  fixtures(args) {
    const id = arg(args, "case", DEFAULT_CASE);
    const spec = loadCase(caseDir(id));
    const checks = sha256File(spec.heldOutPath);
    let mismatches = 0;
    for (const name of readdirSync(fixturesDir(id)).filter((n) => !n.startsWith("_")).sort()) {
      const fx = loadFixture(fixturesDir(id), name);
      const ws = buildArm(spec, fx.arm);
      applyFixture(fixturesDir(id), name, ws.dir);
      const result = verifyCandidate({ spec, armDir: buildArm(spec, fx.arm).dir, candidateDir: ws.dir, expectedChecksSha256: checks, runner: args.includes("--sandbox") ? dockerRunner : hostRunner });
      const missing = fx.expect.reasonIncludes.filter((want) => !result.reasons.some((r) => r.includes(want)));
      const match = result.verdict === fx.expect.verdict && missing.length === 0;
      if (!match) mismatches++;
      console.log(`${match ? "ok  " : "MISS"} ${name.padEnd(24)} ${fx.arm} expected ${fx.expect.verdict}, got ${result.verdict}${result.reasons.length ? ` (${result.reasons[0]}${result.reasons.length > 1 ? `, +${result.reasons.length - 1}` : ""})` : ""}${missing.length ? ` missing reasons: ${missing.join(" / ")}` : ""}`);
    }
    return mismatches ? 1 : 0;
  },
  plan(args) {
    const { spec } = loadExperiment(resolve(arg(args, "experiment")));
    const low = Number(arg(args, "low", "0.3"));
    const high = Number(arg(args, "high", "1"));
    console.log(JSON.stringify(planCost(spec, { low, high }), null, 2));
    return 0;
  },
};

const asyncCommands: Record<string, (args: string[]) => Promise<number>> = {
  async "sandbox-probe"(args) {
    const { spec: experiment } = loadExperiment(resolve(arg(args, "experiment", DEFAULT_EXPERIMENT)));
    const out = resolve(arg(args, "out", join("results/sandbox-probe", experiment.id)));
    if (existsSync(out) && readdirSync(out).length > 0) throw new Error(`${out} already holds probe evidence; pass a new --out`);
    const caseSpec = loadCase(caseDir(experiment.case));
    const result = probeSandbox(caseSpec, experiment.checksSha256);
    const loading = loadingProbe(experiment.harness.model, experiment.harness.cliVersion);
    result.checks.push(...loading.checks);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "loading-receipt.json"), JSON.stringify(loading.receipt, null, 2));
    writeFileSync(join(out, "probe.json"), JSON.stringify(result, null, 2));
    writeFileSync(join(out, "probe.md"), renderProbe(result.checks));
    console.log(renderProbe(result.checks));
    return result.checks.every((c) => c.ok) ? 0 : 1;
  },
  async run(args) {
    const phase = arg(args, "phase") as Phase;
    const { spec: experiment, sha256 } = loadExperiment(resolve(arg(args, "experiment")));
    const caseSpec = loadCase(caseDir(experiment.case));
    const runId = arg(args, "run-id");
    const { runDir, phaseDir, attemptsLog } = runPaths(arg(args, "out", "results"), runId, phase);
    const ledgerPath = resolve(arg(args, "ledger", join(ROOT, "ledgers", "anthropic-claude.json")));
    ensureImage();
    const manifest = freezeManifest({
      labRoot: ROOT, runDir, sandboxImage: SANDBOX_IMAGE,
      manifest: { runId, experimentSha256: sha256, checksSha256: experiment.checksSha256, cliVersion: experiment.harness.cliVersion, model: experiment.harness.model },
    });
    mkdirSync(phaseDir, { recursive: true });
    mkdirSync(dirname(ledgerPath), { recursive: true });
    const ledger = BudgetLedger.open(ledgerPath, experiment.budget.capUsd);
    console.log(`ledger: $${ledger.spentUsd.toFixed(2)} charged across ${ledger.attempts} prior attempts, $${ledger.headroomUsd.toFixed(2)} headroom`);
    try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    const adapter = claudeCodeAdapter({
      bin: arg(args, "claude-bin", "claude"),
      path: process.env.PATH ?? "/usr/bin:/bin",
      apiKey,
      transcriptDir: join(phaseDir, "transcripts"),
      pinnedVersion: experiment.harness.cliVersion,
      sandbox: true,
      pricing: experiment.pricing,
    });
    if (!experiment.pricing) throw new Error("live runs need a lab-owned pricing table in the experiment file");
    ensureEgress();
    const version = { ...(await adapter.version()), model: experiment.harness.model };
    for (const arm of caseSpec.arms) {
      const audit = auditArm(caseSpec, arm.id, buildArm(caseSpec, arm.id).dir);
      if (!audit.ok) throw new Error(`${arm.id} failed the contamination audit; not running`);
    }
    const results = await runPhase({
      experiment, caseSpec, phase, adapter, ledger,
      concurrency: Number(arg(args, "concurrency", "1")),
      candidateRunner: dockerRunner,
      artifactDir: join(phaseDir, "artifacts"),
      runId,
      onAttempt: (slot, a, stage) => appendFileSync(attemptsLog, JSON.stringify({ slot, stage, ...a }) + "\n"),
      onSlot: (r) => {
        console.log(`${r.slot.key} ${r.verdict} attempts=${r.attempts.length} cost=${r.attempts.reduce((a, b) => a + b.costUsd, 0).toFixed(2)} spent=${ledger.spentUsd.toFixed(2)} ${r.reasons.slice(0, 2).join("; ")}`);
      },
    });
    const report = { ...buildReport({ label: "live", experiment, experimentSha256: sha256, phase, version, results, ledger }), runId, manifest };
    writeFileSync(join(phaseDir, "report.json"), JSON.stringify(report, null, 2));
    writeFileSync(join(phaseDir, "report.md"), renderMarkdown(report));
    writeFileSync(join(phaseDir, "slots.json"), JSON.stringify(results.map((r) => ({ ...r, verification: r.verification && { ...r.verification } })), null, 2));
    console.log(renderMarkdown(report).split("## Runs")[0]);
    return 0;
    } finally {
      ledger.close();
    }
  },
};

const [command, ...rest] = process.argv.slice(2);
const handler = command ? commands[command] : undefined;
const asyncHandler = command ? asyncCommands[command] : undefined;
if (handler) process.exitCode = handler(rest);
else if (asyncHandler) process.exitCode = await asyncHandler(rest);
else {
  console.error(`usage: crashlab <${[...Object.keys(commands), ...Object.keys(asyncCommands)].join("|")}> [options]`);
  process.exitCode = 2;
}
