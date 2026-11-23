import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/run-records.js";
import { fixture } from "./fixture.js";

test("well formed rows, a failed attempt then a blocked one, pass", () => {
  assert.deepEqual(check(fixture("run-records", "pass")), []);
});

test("each malformed row fails at its line with the fix", () => {
  const failures = check(fixture("run-records", "fail"));
  assert.ok(failures.every(({ path }) => path === "data/runs.jsonl"));
  const at = (line) => failures.filter((f) => f.line === line).map((f) => f.message);
  assert.match(at(1)[0], /not a JSON object/);
  assert.match(at(2)[0], /status must be one of passed, failed, blocked/);
  assert.match(at(3)[0], /blocked row needs an ask/);
  assert.match(at(4)[0], /attempt 2 of run c follows attempt 0/);
  assert.match(at(6)[0], /run d already ended passed at attempt 1/);
  assert.ok(at(7).some((m) => /attempt 4 is over loop_cap 3/.test(m)));
  assert.ok(at(8).some((m) => /missing key at/.test(m)));
  assert.deepEqual(at(5), []);
});
