import type { LegacyOrder } from "../legacy/decoder.ts";
import { formatAmount } from "./amounts.ts";

export function totalsByCurrency(orders: LegacyOrder[]): Map<string, { count: number; total: number }> {
  const totals = new Map<string, { count: number; total: number }>();
  for (const order of orders) {
    const entry = totals.get(order.currency) ?? { count: 0, total: 0 };
    totals.set(order.currency, { count: entry.count + 1, total: entry.total + order.amount });
  }
  return totals;
}

export function formatSummary(orders: LegacyOrder[]): string {
  const lines = [`orders: ${orders.length}`];
  for (const [currency, { count, total }] of [...totalsByCurrency(orders)].sort()) {
    lines.push(`${currency}: ${count} (${formatAmount(total, currency)})`);
  }
  return lines.join("\n");
}
