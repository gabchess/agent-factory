import { RUN_RECORD, isA } from "./artifacts.js";

const STRING = (value) => typeof value === "string";
const COUNT = (value) => Number.isInteger(value) && value >= 1;
const NAMES = (value) => Array.isArray(value) && value.every(STRING);

const KEYS = {
  at: [(value) => STRING(value) && !Number.isNaN(Date.parse(value)), "an ISO 8601 time"],
  run: [(value) => STRING(value) && value.length > 0, "a run id"],
  task: [STRING, "a string"],
  attempt: [COUNT, "a whole number from 1"],
  loop_cap: [COUNT, "a whole number from 1"],
  verdict: [(value) => ["pass", "fail"].includes(value), "one of pass, fail"],
  status: [(value) => ["passed", "failed", "blocked"].includes(value), "one of passed, failed, blocked"],
  reason: [STRING, "a string"],
  missing: [NAMES, "a list of names"],
  unlisted: [NAMES, "a list of names"],
  ask: [STRING, "a string"],
  dry_run: [(value) => typeof value === "boolean", "true or false"],
};

const FIX = "Rows come from the orchestrate-task gate script. Fix the row before it reaches main, where rows are never edited";

function parse(line) {
  try {
    const row = JSON.parse(line);
    return row && typeof row === "object" && !Array.isArray(row) ? row : null;
  } catch {
    return null;
  }
}

function shape(row) {
  return Object.entries(KEYS).flatMap(([key, [valid, expected]]) => {
    if (!(key in row)) return [`missing key ${key}`];
    return valid(row[key]) ? [] : [`${key} must be ${expected}`];
  });
}

function sequence(row, runs) {
  const problems = [];
  const last = runs.get(row.run);
  if (last && last.status !== "failed") problems.push(`run ${row.run} already ended ${last.status} at attempt ${last.attempt}`);
  else if (row.attempt !== (last?.attempt ?? 0) + 1) problems.push(`attempt ${row.attempt} of run ${row.run} follows attempt ${last?.attempt ?? 0}`);
  if (row.attempt > row.loop_cap) problems.push(`attempt ${row.attempt} is over loop_cap ${row.loop_cap}`);
  if (row.status === "blocked" && !row.ask.trim()) problems.push("a blocked row needs an ask");
  if (row.status === "passed" && (row.verdict !== "pass" || row.missing.length || row.unlisted.length)) problems.push("a passed row needs a pass verdict and no missing or unlisted names");
  return problems;
}

function rowFailures({ path, text }) {
  const runs = new Map();
  return text.split("\n").flatMap((line, index) => {
    if (!line.trim()) return [];
    const fail = (problem) => ({ path, line: index + 1, message: `${problem}. ${FIX}.` });
    const row = parse(line);
    if (!row) return [fail("row is not a JSON object")];
    const problems = shape(row);
    if (problems.length) return problems.map(fail);
    const ordered = sequence(row, runs);
    runs.set(row.run, row);
    return ordered.map(fail);
  });
}

export const check = ({ files }) => files.filter(isA(RUN_RECORD)).flatMap(rowFailures);
