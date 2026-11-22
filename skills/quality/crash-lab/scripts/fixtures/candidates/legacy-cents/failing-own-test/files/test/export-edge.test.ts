import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount } from "../src/orders/export.ts";

test("formats yen", () => {
  assert.equal(formatAmount(500, "JPY"), "5.00");
});
