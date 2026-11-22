import type { LegacyOrder } from "../legacy/decoder.ts";
import { formatAmount } from "./amounts.ts";

export function toCsv(orders: LegacyOrder[]): string {
  const rows = orders.map((o) => `${o.id},${o.currency},${formatAmount(o.amount, o.currency)}`);
  return ["id,currency,amount", ...rows].join("\n") + "\n";
}
