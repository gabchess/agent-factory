const DECIMALS: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0, KRW: 0 };

export function formatAmount(amount: number, currency: string): string {
  const digits = DECIMALS[currency];
  if (digits === undefined) throw new Error(`unknown currency ${currency}`);
  const sign = amount < 0 ? "-" : "";
  const whole = (amount < 0 ? -BigInt(amount) : BigInt(amount)).toString();
  if (digits === 0) return sign + whole;
  const padded = whole.padStart(digits + 1, "0");
  return `${sign}${padded.slice(0, -digits)}.${padded.slice(-digits)}`;
}
