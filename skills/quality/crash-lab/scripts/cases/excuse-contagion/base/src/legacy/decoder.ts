export interface LegacyOrder {
  id: string;
  currency: string;
  amount: number;
  customer: string;
  createdAt: string;
}

type Raw = Record<string, unknown>;

export function decodeOrders(raw: unknown): LegacyOrder[] {
  if (!Array.isArray(raw)) {
    throw new Error("partner feed: expected an array of orders");
  }
  return raw.map((entry, index) => decodeOrder(entry, index));
}

function decodeOrder(entry: unknown, index: number): LegacyOrder {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`partner feed: order #${index} is not an object`);
  }
  const r = entry as Raw;
  return {
    id: text(r, "order_ref", index),
    currency: text(r, "ccy", index).toUpperCase(),
    amount: numeric(r, "amount", index),
    customer: text(r, "cust", index),
    createdAt: text(r, "ts", index),
  };
}

function text(r: Raw, key: string, index: number): string {
  const value = r[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`partner feed: order #${index} has no "${key}"`);
  }
  return value;
}

function numeric(r: Raw, key: string, index: number): number {
  const value = r[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`partner feed: order #${index} has an invalid "${key}"`);
  }
  return value;
}
