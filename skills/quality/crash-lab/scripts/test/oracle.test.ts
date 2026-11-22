import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMinorUnits } from "../src/artifact-verification/oracle.ts";

test("formats two-decimal currencies exactly", () => {
  assert.equal(formatMinorUnits(1234, "USD"), "12.34");
  assert.equal(formatMinorUnits(5, "USD"), "0.05");
  assert.equal(formatMinorUnits(0, "EUR"), "0.00");
  assert.equal(formatMinorUnits(-5, "USD"), "-0.05");
  assert.equal(formatMinorUnits(-1234, "USD"), "-12.34");
});

test("is exact where float division loses a cent", () => {
  assert.equal(formatMinorUnits(9007199254740990, "USD"), "90071992547409.90");
  assert.equal(formatMinorUnits(-9007199254740990, "USD"), "-90071992547409.90");
  assert.notEqual((9007199254740990 / 100).toFixed(2), "90071992547409.90");
});

test("handles zero-decimal currencies", () => {
  assert.equal(formatMinorUnits(1234, "JPY"), "1234");
  assert.equal(formatMinorUnits(-500, "JPY"), "-500");
  assert.equal(formatMinorUnits(0, "JPY"), "0");
});

test("rejects unsafe integers and unknown currencies", () => {
  assert.throws(() => formatMinorUnits(9007199254740992, "USD"));
  assert.throws(() => formatMinorUnits(12.5, "USD"));
  assert.throws(() => formatMinorUnits(1, "XXX"));
});
