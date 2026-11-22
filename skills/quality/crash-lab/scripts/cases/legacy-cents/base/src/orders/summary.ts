import type { LegacyOrder } from "../legacy/decoder.ts";

export function countByCurrency(orders: LegacyOrder[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const order of orders) {
    counts.set(order.currency, (counts.get(order.currency) ?? 0) + 1);
  }
  return counts;
}

export function formatSummary(orders: LegacyOrder[]): string {
  const lines = [`orders: ${orders.length}`];
  for (const [currency, count] of [...countByCurrency(orders)].sort()) {
    lines.push(`${currency}: ${count}`);
  }
  return lines.join("\n");
}
