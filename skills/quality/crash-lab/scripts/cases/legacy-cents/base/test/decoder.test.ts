import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeOrders } from "../src/legacy/decoder.ts";

test("decodes partner fields into orders", () => {
  const [order] = decodeOrders([
    { order_ref: "P-100", ccy: "usd", amount: 1200, cust: "acme", ts: "2026-03-02T10:00:00Z" },
  ]);
  assert.equal(order.id, "P-100");
  assert.equal(order.currency, "USD");
  assert.equal(order.amount, 1200);
  assert.equal(order.customer, "acme");
});

test("rejects a feed that is not an array", () => {
  assert.throws(() => decodeOrders({}), /expected an array/);
});

test("rejects an order with a non-numeric amount", () => {
  assert.throws(
    () => decodeOrders([{ order_ref: "P-1", ccy: "USD", amount: "12", cust: "a", ts: "t" }]),
    /invalid "amount"/,
  );
});
