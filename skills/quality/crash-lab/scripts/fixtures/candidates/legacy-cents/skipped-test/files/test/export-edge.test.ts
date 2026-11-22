import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount } from "../src/orders/export.ts";

test.skip("formats yen without decimals", () => {
  assert.equal(formatAmount(500, "JPY"), "500");
});
