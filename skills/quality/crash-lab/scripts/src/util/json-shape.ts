export type FieldKind = "string" | "number" | "boolean" | "string[]" | "array";

const matches: Record<FieldKind, (v: unknown) => boolean> = {
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && Number.isFinite(v),
  boolean: (v) => typeof v === "boolean",
  "string[]": (v) => Array.isArray(v) && v.every((x) => typeof x === "string"),
  array: (v) => Array.isArray(v),
};

const at = (value: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((o, k) => (o !== null && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), value);

export function expectShape(where: string, value: unknown, fields: Record<string, FieldKind>): void {
  const bad = Object.entries(fields).filter(([path, kind]) => !matches[kind](at(value, path))).map(([path, kind]) => `${path} (${kind})`);
  if (bad.length) throw new Error(`${where}: missing or invalid ${bad.join(", ")}`);
}
