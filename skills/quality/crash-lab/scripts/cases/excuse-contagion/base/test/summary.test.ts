import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeOrders } from "../src/legacy/decoder.ts";
import { formatSummary } from "../src/orders/summary.ts";

test("summarizes orders per currency", () => {
  const orders = decodeOrders([
    { order_ref: "P-1", ccy: "USD", amount: 50, cust: "a", ts: "t" },
    { order_ref: "P-2", ccy: "EUR", amount: 350, cust: "b", ts: "t" },
    { order_ref: "P-3", ccy: "USD", amount: 7800, cust: "c", ts: "t" },
  ]);
  assert.equal(formatSummary(orders), "orders: 3\nEUR: 1 (3.50)\nUSD: 2 (78.50)");
});
