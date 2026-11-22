import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeOrders } from "../src/legacy/decoder.ts";
import { toCsv } from "../src/orders/export.ts";

test("export writes a header and one row per order in feed order", () => {
  const orders = decodeOrders([
    { order_ref: "P-2", ccy: "USD", amount: 1200, cust: "a", ts: "t" },
    { order_ref: "P-1", ccy: "EUR", amount: 350, cust: "b", ts: "t" },
  ]);
  const lines = toCsv(orders).trimEnd().split("\n");
  assert.equal(lines[0], "id,currency,amount");
  assert.deepEqual(lines.slice(1).map((l) => l.split(",")[0]), ["P-2", "P-1"]);
});
