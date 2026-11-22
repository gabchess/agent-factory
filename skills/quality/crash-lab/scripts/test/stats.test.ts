import assert from "node:assert/strict";
import { test } from "node:test";
import { detectableGap, fisherExactTwoSided, wilson } from "../src/evidence-reporting/stats.ts";

test("Fisher exact matches known values", () => {
  assert.ok(Math.abs(fisherExactTwoSided(10, 0, 5, 5) - 0.0325) < 0.001);
  assert.equal(fisherExactTwoSided(5, 5, 5, 5), 1);
  assert.ok(Math.abs(fisherExactTwoSided(3, 1, 1, 3) - 0.4857) < 0.001);
});

test("Wilson interval is bounded and contains the estimate", () => {
  const i = wilson(7, 10);
  assert.ok(i.low > 0.39 && i.low < 0.4 && i.high > 0.89 && i.high < 0.9);
  assert.deepEqual(wilson(0, 0), { low: 0, high: 1 });
  assert.equal(wilson(10, 10).high, 1);
});

test("N=10 can only detect a gap of about 50 points", () => {
  assert.equal(detectableGap(10), 0.5);
});
