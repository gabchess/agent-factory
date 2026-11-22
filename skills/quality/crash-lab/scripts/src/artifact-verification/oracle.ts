export const CURRENCY_EXPONENT: Readonly<Record<string, number>> = { USD: 2, EUR: 2, GBP: 2, JPY: 0, KRW: 0 };

export function formatMinorUnits(amount: number, currency: string): string {
  if (!Number.isSafeInteger(amount)) throw new Error(`oracle: ${amount} is not a safe integer`);
  const exponent = CURRENCY_EXPONENT[currency];
  if (exponent === undefined) throw new Error(`oracle: no exponent for ${currency}`);
  const negative = amount < 0;
  const digits = (negative ? -BigInt(amount) : BigInt(amount)).toString();
  const sign = negative ? "-" : "";
  if (exponent === 0) return sign + digits;
  const padded = digits.padStart(exponent + 1, "0");
  return `${sign}${padded.slice(0, -exponent)}.${padded.slice(-exponent)}`;
}
