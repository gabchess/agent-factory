export interface PriceTable {
  model: string;
  input: number;
  output: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  source: string;
}

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
}

export function priceUsage(u: TokenUsage, p: PriceTable): number {
  const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const write5m = (u.cache_creation_input_tokens ?? 0) - write1h;
  return ((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + write5m * p.cacheWrite5m + write1h * p.cacheWrite1h + (u.cache_read_input_tokens ?? 0) * p.cacheRead) / 1e6;
}

export function chargeFor(reported: number | "unknown", usage: TokenUsage | null, p: PriceTable | undefined): number | "unknown" {
  const priced = usage && p ? priceUsage(usage, p) : null;
  if (reported === "unknown") return priced ?? "unknown";
  return priced === null ? reported : Math.max(reported, priced);
}
