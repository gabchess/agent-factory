import { fileURLToPath } from "node:url";

export interface TestCounts {
  tests: number;
  pass: number;
  fail: number;
  cancelled: number;
  skipped: number;
  todo: number;
}

const COUNT_KEYS = ["tests", "pass", "fail", "cancelled", "skipped", "todo"];
const SUMMARY_KEYS = ["tests", "passed", "failed", "cancelled", "skipped", "todo"];

const numericFields = (v: unknown, keys: string[]): boolean =>
  v !== null && typeof v === "object" && keys.every((k) => { const n = (v as Record<string, unknown>)[k]; return Number.isInteger(n) && (n as number) >= 0; });

export const COUNT_REPORTER = fileURLToPath(new URL("./count-reporter.mjs", import.meta.url));

export function parseReporterCounts(text: string): { counts: TestCounts } | { error: string } {
  let raw: { leaf?: unknown; summary?: unknown };
  try {
    raw = JSON.parse(text.trim().split("\n").pop() ?? "");
  } catch {
    return { error: "reporter output missing or corrupt" };
  }
  if (raw === null || typeof raw !== "object") return { error: "reporter output missing or corrupt" };
  if (raw.summary === null || raw.summary === undefined) return { error: "runner summary missing" };
  if (!numericFields(raw.leaf, COUNT_KEYS) || !numericFields(raw.summary, SUMMARY_KEYS)) return { error: "reporter output has counts that are not non-negative integers" };
  const leaf = raw.leaf as TestCounts;
  const summary = raw.summary as Record<string, number>;
  const fromSummary: TestCounts = {
    tests: summary.tests, pass: summary.passed, fail: summary.failed,
    cancelled: summary.cancelled, skipped: summary.skipped, todo: summary.todo,
  };
  const keys = Object.keys(leaf) as (keyof TestCounts)[];
  if (keys.some((k) => leaf[k] !== fromSummary[k])) return { error: `inconsistent counts: events ${JSON.stringify(leaf)} vs summary ${JSON.stringify(fromSummary)}` };
  if (leaf.tests !== leaf.pass + leaf.fail + leaf.cancelled + leaf.skipped + leaf.todo) return { error: "counts do not add up" };
  return { counts: leaf };
}

export function parseTapSummary(tap: string): TestCounts | null {
  const read = (key: string): number | null => {
    const m = new RegExp(`^# ${key} (\\d+)$`, "m").exec(tap);
    return m ? Number(m[1]) : null;
  };
  const values = { tests: read("tests"), pass: read("pass"), fail: read("fail"), cancelled: read("cancelled"), skipped: read("skipped"), todo: read("todo") };
  if (Object.values(values).some((v) => v === null)) return null;
  return values as TestCounts;
}

export const FOCUS_OR_DISABLE_PATTERNS: RegExp[] = [
  /\b(test|it|describe|suite)\.(only|skip|todo)\s*\(/,
  /\{\s*[^}]*\b(only|skip|todo)\s*:\s*(true|['"`])/,
  /\b(xit|xdescribe|xtest|fit|fdescribe)\s*\(/,
  /\bt\.(skip|todo)\s*\(/,
];
