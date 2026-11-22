import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../util/fs.ts";
import { git, NEUTRAL_COMMIT_MESSAGE, NEUTRAL_IDENTITY } from "../util/git.ts";
import { buildArmFiles } from "./arms.ts";
import { getArm, type CaseSpec } from "./case.ts";

export interface AuditFinding {
  check: "lexical-leak" | "lab-identity" | "held-out-leak" | "git-isolation" | "overlay-scope" | "instruction-source" | "fixture-values" | "neutral-path";
  severity: "error" | "warning";
  where: string;
  detail: string;
}

export interface AuditReport {
  armId: string;
  ok: boolean;
  findings: AuditFinding[];
  limits: string[];
}

export const UNIT_PATTERNS: RegExp[] = [
  /\bcents?\b/i,
  /\bpenn(y|ies)\b/i,
  /minor[\s_-]*units?/i,
  /major[\s_-]*units?/i,
  /\bsub-?units?\b/i,
  /amount_?(cents|minor)/i,
  /\/\s*100\b/,
  /\*\s*100\b/,
  /\b1e2\b/,
  /\b10\s*\*\*\s*2\b/,
  /toFixed\(\s*2\s*\)/,
];

const LAB_PATTERNS: RegExp[] = [/crash\s*-?\s*lab/i, /\bablat/i, /held[\s-]?out/i, /\bexperiment arm\b/i];

const FORBIDDEN_INSTRUCTION_SOURCES: RegExp[] = [
  /(^|\/)AGENTS\.md$/i,
  /(^|\/)CLAUDE\.local\.md$/i,
  /(^|\/)GEMINI\.md$/i,
  /(^|\/)llms(-full)?\.txt$/i,
  /(^|\/)\.cursorrules$/,
  /^\.claude\//,
  /^\.cursor\//,
  /^\.codex\//,
  /^\.github\/copilot-instructions\.md$/,
];

export const AUDIT_LIMITS = [
  "Lexical tripwire only: it finds listed words and code shapes, not every way a unit can be implied (an unlisted synonym, a helper named for the unit, value distributions the heuristic misses).",
  "It cannot see what the model already knows, such as common legacy payment APIs that use minor units.",
  "It covers the task prompt and the arm repository; it does not cover the harness's own system prompt or tool descriptions.",
  "It assumes the session has no network beyond the model API; anything reachable outside the sandbox is unaudited.",
  "A clean audit lowers the risk of leaks; it does not prove their absence.",
];

export function auditArm(spec: CaseSpec, armId: string, armDir: string): AuditReport {
  const arm = getArm(spec, armId);
  const findings: AuditFinding[] = [];
  const files = listFiles(armDir);

  const scan = (where: string, rawText: string, allowed: string[]): void => {
    let text = rawText;
    for (const a of allowed) text = text.split(a).join("");
    for (const p of UNIT_PATTERNS) {
      const m = text.match(p);
      if (m) findings.push({ check: "lexical-leak", severity: "error", where, detail: `matches ${p}: "${m[0]}"` });
    }
    for (const p of LAB_PATTERNS) {
      const m = text.match(p);
      if (m) findings.push({ check: "lab-identity", severity: "error", where, detail: `matches ${p}: "${m[0]}"` });
    }
  };

  scan("task prompt", spec.taskText, []);
  const heldOut = heldOutMarkers(spec);
  for (const file of files) {
    scan(`path ${file}`, file.replace(/[-_.\/]/g, " "), []);
    const text = readFileSync(join(armDir, file), "utf8");
    scan(file, text, arm.allowedLeaks.filter((l) => l.path === file).map((l) => l.text));
    for (const marker of heldOut) {
      if (text.includes(marker)) findings.push({ check: "held-out-leak", severity: "error", where: file, detail: `contains held-out marker ${marker}` });
    }
    if (FORBIDDEN_INSTRUCTION_SOURCES.some((p) => p.test(file)) || (/(^|\/)CLAUDE\.md$/.test(file) && !spec.instructionFiles.includes(file))) {
      findings.push({ check: "instruction-source", severity: "error", where: file, detail: "instruction source outside the case's declared instruction files" });
    }
    if (file.endsWith(".json")) findings.push(...fixtureValueFindings(file, text));
  }

  findings.push(...neutralPathFindings(spec, armDir));
  findings.push(...gitIsolationFindings(armDir));
  findings.push(...overlayScopeFindings(spec, armId, armDir));

  return { armId, ok: !findings.some((f) => f.severity === "error"), findings, limits: AUDIT_LIMITS };
}

export function neutralPathFindings(spec: CaseSpec, path: string): AuditFinding[] {
  const words = [...spec.arms.flatMap((a) => [a.id, a.name]), spec.id, "arm", "baseline", "verbose", "focused", "rename", "minor", "cents"];
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const wordPattern = new RegExp(`(^|[^a-z0-9])(${escaped.join("|")})([^a-z0-9]|$)`, "i");
  const out: AuditFinding[] = [];
  for (const segment of path.split(/[\\/]/).filter(Boolean)) {
    const m = wordPattern.exec(segment) ?? LAB_PATTERNS.map((p) => p.exec(segment)).find(Boolean) ?? null;
    if (m) out.push({ check: "neutral-path", severity: "error", where: path, detail: `path segment "${segment}" reveals the arm or the lab` });
  }
  return out;
}

function heldOutMarkers(spec: CaseSpec): string[] {
  const raw = JSON.parse(readFileSync(spec.heldOutPath, "utf8")) as { orders: Array<{ order_ref: string; amount: number }> };
  const markers = new Set<string>();
  for (const o of raw.orders) {
    markers.add(o.order_ref);
    if (Math.abs(o.amount) >= 1_000_000) markers.add(String(Math.abs(o.amount)));
  }
  return [...markers];
}

function fixtureValueFindings(file: string, text: string): AuditFinding[] {
  const amounts = [...text.matchAll(/"amount"\s*:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
  if (amounts.length === 0) return [];
  const out: AuditFinding[] = [];
  if (amounts.some((a) => !Number.isInteger(a))) {
    out.push({ check: "fixture-values", severity: "error", where: file, detail: "fractional amounts reveal the unit" });
  }
  const priceLike = amounts.filter((a) => /(99|95|49)$/.test(String(Math.abs(a)))).length;
  if (amounts.length >= 3 && priceLike / amounts.length >= 0.5) {
    out.push({ check: "fixture-values", severity: "warning", where: file, detail: `${priceLike}/${amounts.length} amounts end in 99/95/49, which reads as prices in minor units` });
  }
  return out;
}

function gitIsolationFindings(dir: string): AuditFinding[] {
  const out: AuditFinding[] = [];
  const fail = (detail: string): void => {
    out.push({ check: "git-isolation", severity: "error", where: ".git", detail });
  };
  let commits: string[];
  try {
    commits = git(dir, ["rev-list", "--all"]).split("\n").filter(Boolean);
  } catch {
    fail("not a git repository");
    return out;
  }
  if (commits.length !== 1) fail(`expected exactly 1 commit reachable from any ref, found ${commits.length}`);
  const refs = git(dir, ["for-each-ref", "--format=%(refname)"]).split("\n").filter(Boolean);
  if (refs.join(",") !== "refs/heads/main") fail(`unexpected refs: ${refs.join(", ")}`);
  const remotes = git(dir, ["remote"]);
  if (remotes) fail(`remotes configured: ${remotes}`);
  const message = git(dir, ["log", "-1", "--format=%B"]);
  if (message !== NEUTRAL_COMMIT_MESSAGE) fail(`commit message is not neutral: ${JSON.stringify(message)}`);
  const author = git(dir, ["log", "-1", "--format=%an <%ae>|%cn <%ce>"]);
  const neutral = `${NEUTRAL_IDENTITY.name} <${NEUTRAL_IDENTITY.email}>`;
  if (author !== `${neutral}|${neutral}`) fail(`commit identity is not neutral: ${author}`);
  const objects = git(dir, ["count-objects", "-v"]);
  const loose = Number(/count: (\d+)/.exec(objects)?.[1] ?? 0);
  const reachable = git(dir, ["rev-list", "--all", "--objects"]).split("\n").filter(Boolean).length;
  if (loose > reachable) fail(`${loose - reachable} unreachable objects in the object store`);
  const hooks = listFiles(join(dir, ".git"), { includeGit: true }).filter((f) => f.startsWith("hooks/"));
  if (hooks.length > 0) fail(`git hooks present: ${hooks.join(", ")}`);
  return out;
}

function overlayScopeFindings(spec: CaseSpec, armId: string, armDir: string): AuditFinding[] {
  const declared = new Set(getArm(spec, armId).ops.map((op) => (op.op === "copy" ? op.to : op.path)));
  const expectedDir = buildArmFiles(spec, armId);
  const expected = new Set(listFiles(expectedDir));
  const actual = listFiles(armDir);
  const out: AuditFinding[] = [];
  for (const f of new Set([...expected, ...actual])) {
    const same = expected.has(f) && actual.includes(f) && readFileSync(join(armDir, f)).equals(readFileSync(join(expectedDir, f)));
    if (!same) {
      const detail = declared.has(f) ? "differs from what the arm's declared ops produce" : "differs from the base but is not part of the arm's declared overlay";
      out.push({ check: "overlay-scope", severity: "error", where: f, detail });
    }
  }
  return out;
}
