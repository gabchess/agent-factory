import type { LegacyOrder } from "../legacy/decoder.ts";

const DECIMALS: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0, KRW: 0 };

function decimals(currency: string): number {
  const d = DECIMALS[currency];
  if (d === undefined) throw new Error(`unknown currency ${currency}`);
  return d;
}

export function formatAmount(amount: number, currency: string): string {
  const d = decimals(currency);
  const negative = amount < 0;
  const digits = (negative ? -BigInt(amount) : BigInt(amount)).toString();
  const sign = negative ? "-" : "";
  if (d === 0) return sign + digits;
  const padded = digits.padStart(d + 1, "0");
  return `${sign}${padded.slice(0, -d)}.${padded.slice(-d)}`;
}
export function toCsv(orders: LegacyOrder[]): string {
  const rows = orders.map((o) => `${o.id},${o.currency},${formatAmount(o.amountMinorUnits, o.currency)}`);
  return ["id,currency,amount", ...rows].join("\n") + "\n";
}