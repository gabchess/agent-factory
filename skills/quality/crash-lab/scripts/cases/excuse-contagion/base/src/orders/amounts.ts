const DECIMALS: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0, KRW: 0 };

export function formatAmount(amount: number, currency: string): string {
  const digits = DECIMALS[currency];
  if (digits === undefined) throw new Error(`unknown currency ${currency}`);
  return (amount / 10 ** digits).toFixed(digits);
}
