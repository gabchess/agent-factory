import { attemptEvidenceProblems } from "./evidence.ts";
import type { ExperimentSpec, Phase } from "../experiment-design/experiment.ts";
import type { HarnessVersion } from "../adapters/types.ts";
import { schedule } from "../experiment-design/experiment.ts";
import type { AttemptRecord, Ledger, SlotResult } from "../session-execution/runner.ts";
import { detectableGap, fisherExactTwoSided, wilson, type Interval } from "./stats.ts";

export const REPORT_SCHEMA_VERSION = 2;

export interface ArmSummary {
  arm: string;
  slots: number;
  pass: number;
  fail: number;
  unknown: number;
  notRun: number;
  passRate: number | null;
  interval: Interval | null;
  sensitivity: Interval | null;
  attempts: number;
  costUsd: number;
  medianTurns: number | null;
  claimedSuccessButFailed: number;
}

export interface ComparisonResult {
  a: string;
  b: string;
  role: "primary" | "exploratory";
  question: string;
  pValue: number | null;
  conclusion: string;
}

export interface Report {
  schemaVersion: number;
  label: "offline-simulation" | "live";
  experimentId: string;
  experimentSha256: string;
  phase: Phase;
  findingsEligible: boolean;
  valid: boolean;
  validityNotes: string[];
  versions: HarnessVersion & { node: string; ruleset: string; checksSha256: string };
  budget: { capUsd: number; confirmed: boolean; spentUsd: number; reportedUsd: number; attempts: number; headroomUsd: number; experimentCapUsd: number | null; experimentSpentUsd: number };
  significanceReference: { n: number; alpha: number; otherArmMaxPasses: number | null } | null;
  arms: ArmSummary[];
  comparisons: ComparisonResult[];
  runs: Array<{ slot: string; arm: string; verdict: string; attempts: number; attemptRecords: AttemptRecord[]; reasons: string[]; claimedSuccessButFailed: boolean }>;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function summarizeArm(arm: string, results: SlotResult[]): ArmSummary {
  const mine = results.filter((r) => r.slot.arm === arm);
  const count = (v: string): number => mine.filter((r) => r.verdict === v).length;
  const pass = count("pass");
  const fail = count("fail");
  const unknown = count("unknown");
  const resolved = pass + fail;
  const attempts = mine.flatMap((r) => r.attempts);
  return {
    arm,
    slots: mine.length,
    pass,
    fail,
    unknown,
    notRun: count("not_run"),
    passRate: resolved ? pass / resolved : null,
    interval: resolved ? wilson(pass, resolved) : null,
    sensitivity: resolved + unknown ? { low: pass / (resolved + unknown), high: (pass + unknown) / (resolved + unknown) } : null,
    attempts: attempts.length,
    costUsd: attempts.reduce((s, a) => s + a.costUsd, 0),
    medianTurns: median(attempts.flatMap((a) => (typeof a.turns === "number" ? [a.turns] : []))),
    claimedSuccessButFailed: mine.filter((r) => r.claimedSuccessButFailed).length,
  };
}

function significanceReference(n: number, alpha: number): Report["significanceReference"] {
  const reachable = fisherExactTwoSided(n, 0, 0, n) < alpha;
  return { n, alpha, otherArmMaxPasses: reachable ? Math.round(n * (1 - detectableGap(n, alpha))) : null };
}

export function buildReport(opts: {
  label: Report["label"];
  experiment: ExperimentSpec;
  experimentSha256: string;
  phase: Phase;
  version: HarnessVersion;
  results: SlotResult[];
  ledger: Ledger;
}): Report {
  const { experiment, phase, results } = opts;
  const arms = experiment.arms.map((a) => summarizeArm(a, results));
  const validityNotes: string[] = [];
  const expectedKeys = schedule(experiment, phase).map((s) => s.key);
  const seen = new Map<string, number>();
  for (const r of results) seen.set(r.slot.key, (seen.get(r.slot.key) ?? 0) + 1);
  const missing = expectedKeys.filter((k) => !seen.has(k));
  const duplicated = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  const unexpected = [...seen.keys()].filter((k) => !expectedKeys.includes(k));
  const complete = missing.length === 0 && duplicated.length === 0 && unexpected.length === 0;
  if (!complete) validityNotes.push(`slot matrix does not match the fixed ${expectedKeys.length}-slot schedule: ${missing.length} missing, ${duplicated.length} duplicated, ${unexpected.length} unexpected`);
  const unresolved = results.filter((r) => r.verdict === "unknown" || r.verdict === "not_run").length;
  const share = results.length ? unresolved / results.length : 1;
  const resolvedOk = share <= experiment.invalidIfUnresolvedShareAbove;
  if (!resolvedOk) validityNotes.push(`${unresolved}/${results.length} slots unknown or not run, above the ${experiment.invalidIfUnresolvedShareAbove * 100}% limit`);
  const valid = complete && resolvedOk;
  const transcriptUse = new Map<string, number>();
  for (const r of results) for (const a of r.attempts) if (a.transcriptPath) transcriptUse.set(a.transcriptPath, (transcriptUse.get(a.transcriptPath) ?? 0) + 1);
  const evidenceProblems = results
    .filter((r) => r.verdict === "pass" || r.verdict === "fail")
    .flatMap((r) => {
      const last = r.attempts[r.attempts.length - 1];
      return (last ? attemptEvidenceProblems(last, transcriptUse) : ["no attempt"]).map((p) => `${r.slot.key}: ${p}`);
    });
  const liveBacked = opts.label === "live" && opts.version.harness !== "fake" && evidenceProblems.length === 0;
  if (opts.label === "live" && !liveBacked) {
    validityNotes.push(`labeled live but not backed by linked evidence (harness ${opts.version.harness}, ${evidenceProblems.length} problems)`);
    validityNotes.push(...evidenceProblems.slice(0, 10));
  }
  const findingsEligible = phase === "main" && liveBacked && valid;
  if (!findingsEligible) validityNotes.push("not findings-eligible: no claims may be drawn from this report");
  if (phase !== "main") validityNotes.push(`${phase} results check the pipeline or measure cost; they are never findings`);
  if (opts.label !== "live") validityNotes.push("offline simulation: scripted sessions, not agent behavior");

  const comparisons = compareArms(experiment, arms, findingsEligible);

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    label: opts.label,
    experimentId: experiment.id,
    experimentSha256: opts.experimentSha256,
    phase,
    findingsEligible,
    valid,
    validityNotes,
    versions: { ...opts.version, node: process.version, ruleset: experiment.harness.ruleset, checksSha256: experiment.checksSha256 },
    budget: { capUsd: experiment.budget.capUsd, confirmed: experiment.budget.confirmed, spentUsd: opts.ledger.spentUsd, reportedUsd: opts.ledger.reportedUsd, attempts: opts.ledger.attempts, headroomUsd: opts.ledger.headroomUsd, experimentCapUsd: experiment.budget.experimentCapUsd ?? null, experimentSpentUsd: opts.ledger.spentUsdFor(experiment.id) },
    significanceReference: phase === "main" ? significanceReference(experiment.phases.main.runsPerArm, experiment.alpha) : null,
    arms,
    comparisons,
    runs: results.map((r) => ({
      slot: r.slot.key,
      arm: r.slot.arm,
      verdict: r.verdict,
      attempts: r.attempts.length,
      attemptRecords: r.attempts,
      reasons: r.reasons,
      claimedSuccessButFailed: r.claimedSuccessButFailed,
    })),
  };
}

const pct = (x: number | null): string => (x === null ? "n/a" : `${Math.round(x * 100)}%`);
const iv = (i: Interval | null): string => (i ? `${pct(i.low)} to ${pct(i.high)}` : "n/a");

export function renderMarkdown(r: Report): string {
  const lines = [
    `# ${r.experimentId}: ${r.phase} phase (${r.label})`,
    "",
    `Findings eligible: **${r.findingsEligible ? "yes" : "no"}**. Valid: **${r.valid ? "yes" : "no"}**.`,
    ...r.validityNotes.map((n) => `- ${n}`),
    "",
    "## Versions",
    "",
    `harness ${r.versions.harness} ${r.versions.cliVersion}, model ${r.versions.model}, node ${r.versions.node}, ruleset ${r.versions.ruleset}`,
    `experiment sha256 ${r.experimentSha256}, checks sha256 ${r.versions.checksSha256}`,
    "",
    "## Arms",
    "",
    "| Arm | Slots | Pass | Fail | Unknown | Not run | Pass rate | 95% Wilson | Unknowns as fail / pass | Attempts | Cost USD | Median turns | Claimed success, failed |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...r.arms.map((a) =>
      `| ${a.arm} | ${a.slots} | ${a.pass} | ${a.fail} | ${a.unknown} | ${a.notRun} | ${pct(a.passRate)} | ${iv(a.interval)} | ${iv(a.sensitivity)} | ${a.attempts} | ${a.costUsd.toFixed(2)} | ${a.medianTurns ?? "n/a"} | ${a.claimedSuccessButFailed} |`,
    ),
    "",
    "## Comparisons",
    "",
    ...r.comparisons.map((c) => `- **${c.role}** ${c.a} vs ${c.b}: ${c.question} ${c.conclusion}.`),
  ];
  if (r.significanceReference !== null) {
    const { n, alpha, otherArmMaxPasses } = r.significanceReference;
    const reach = otherArmMaxPasses === null
      ? `no split reaches p < ${alpha} at ${n} runs per arm, not even ${n}/${n} against 0/${n}. Every comparison will be inconclusive`
      : `if one arm passes ${n}/${n}, the other reaches p < ${alpha} only at ${otherArmMaxPasses}/${n} or fewer. At this N most real effects will look inconclusive`;
    lines.push("", `Reference point, not a power estimate: ${reach}, and an inconclusive result never shows the arms are equivalent.`);
  }
  lines.push("", "## Attempts", "", "Charged is what the lab ledger counted against the cap: the larger of the harness's reported cost and the lab's token pricing. Reported is the harness's own figure.", "",
    "| Slot | Attempt | Status | Verdict | Reported USD | Charged USD | Turns | Models | Tool calls |", "|---|---|---|---|---|---|---|---|---|");
  for (const run of r.runs) {
    for (const a of run.attemptRecords) {
      const rep = a.usage?.reportedCostUsd;
      const obs = a.observed;
      lines.push(`| ${run.slot} | ${a.attempt} | ${a.status} | ${a.verification?.verdict ?? "-"} | ${typeof rep === "number" ? rep.toFixed(4) : "unknown"} | ${a.costUsd.toFixed(4)} | ${a.usage?.turns ?? "unknown"} | ${obs ? Object.keys(obs.models).join(", ") || "none" : "not recorded"} | ${obs ? Object.entries(obs.toolCalls).map(([k, v]) => `${k} ${v}`).join(", ") || "none" : "not recorded"} |`);
    }
  }
  lines.push("", "## Budget", "", `Ledger across every run so far: ${r.budget.attempts} attempts. Conservative charge counted against the ${r.budget.capUsd} USD cap: ${r.budget.spentUsd.toFixed(2)} USD (headroom ${r.budget.headroomUsd.toFixed(2)}). Harness-reported cost, a separate measure: ${r.budget.reportedUsd.toFixed(2)} USD. Budget confirmed: ${r.budget.confirmed}.${r.budget.experimentCapUsd === null ? "" : ` This experiment's own cap: ${r.budget.experimentCapUsd} USD, charged so far ${r.budget.experimentSpentUsd.toFixed(2)} USD.`}`);
  lines.push("", "## Runs", "", "| Slot | Verdict | Attempts | Reasons |", "|---|---|---|---|");
  for (const run of r.runs) lines.push(`| ${run.slot} | ${run.verdict} | ${run.attempts} | ${run.reasons.join("; ").replace(/\|/g, "\\|") || "-"} |`);
  return lines.join("\n") + "\n";
}

export function compareArms(experiment: ExperimentSpec, arms: ArmSummary[], findingsEligible: boolean): ComparisonResult[] {
  const byArm = new Map(arms.map((a) => [a.arm, a]));
  return experiment.comparisons.map((c): ComparisonResult => {
    const A = byArm.get(c.a);
    const B = byArm.get(c.b);
    if (!findingsEligible || !A || !B || A.pass + A.fail === 0 || B.pass + B.fail === 0) {
      return { ...c, pValue: null, conclusion: "not analyzed" };
    }
    const p = fisherExactTwoSided(A.pass, A.fail, B.pass, B.fail);
    let conclusion: string;
    if (c.role === "exploratory") conclusion = `exploratory, no claim (p=${p.toFixed(3)})`;
    else if (p < experiment.alpha) conclusion = `difference detected (p=${p.toFixed(3)} < ${experiment.alpha})`;
    else conclusion = `inconclusive: no difference detected at this N (p=${p.toFixed(3)}); this does not show the arms are equivalent`;
    return { ...c, pValue: p, conclusion };
  });

}
