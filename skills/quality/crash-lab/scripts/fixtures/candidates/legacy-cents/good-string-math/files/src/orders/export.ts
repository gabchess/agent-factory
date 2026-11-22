import type { LegacyOrder } from "../legacy/decoder.ts";

const DECIMALS: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0, KRW: 0 };

function decimals(currency: string): number {
  const d = DECIMALS[currency];
  if (d === undefined) throw new Error(`unknown currency ${currency}`);
  return d;
}

export function formatAmount(amount: number, currency: string): string {
  const d = decimals(currency);
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.abs(amount)).padStart(d + 1, "0");
  return d === 0 ? sign + digits : `${sign}${digits.slice(0, -d)}.${digits.slice(-d)}`;
}
export function toCsv(orders: LegacyOrder[]): string {
  const rows = orders.map((o) => `${o.id},${o.currency},${formatAmount(o.amount, o.currency)}`);
  return ["id,currency,amount", ...rows].join("\n") + "\n";
}