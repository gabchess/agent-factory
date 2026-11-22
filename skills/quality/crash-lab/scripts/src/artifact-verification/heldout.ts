import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeTempDir } from "../util/fs.ts";
import { hostRunner, sandboxEnv, type CandidateRunner, type Mount } from "../util/proc.ts";
import { formatMinorUnits } from "./oracle.ts";

export interface HeldOutOrder {
  order_ref: string;
  ccy: string;
  amount: number;
  cust: string;
  ts: string;
  kind: string;
}

export interface HeldOutRow {
  id: string;
  kind: string;
  ok: boolean;
  expected: string;
  actual: string | null;
}

export interface HeldOutResult {
  ran: boolean;
  exitCode: number | null;
  timedOut: boolean;
  headerOk: boolean;
  rows: HeldOutRow[];
  extraLines: number;
  exact: boolean;
  passed: number;
  total: number;
  stderrTail: string;
}

export function loadHeldOut(path: string): HeldOutOrder[] {
  const orders = (JSON.parse(readFileSync(path, "utf8")) as { orders?: HeldOutOrder[] }).orders;
  if (!Array.isArray(orders) || orders.length === 0) throw new Error("held-out checks are empty");
  const ids = new Set<string>();
  for (const o of orders) {
    if (typeof o.order_ref !== "string" || typeof o.ccy !== "string" || !Number.isSafeInteger(o.amount)) throw new Error(`malformed held-out order ${JSON.stringify(o)}`);
    if (ids.has(o.order_ref)) throw new Error(`duplicate held-out order ${o.order_ref}`);
    ids.add(o.order_ref);
    formatMinorUnits(o.amount, o.ccy);
  }
  return orders;
}

export function runHeldOut(candidateDir: string, command: string[], orders: HeldOutOrder[], timeoutMs = 30_000, runner: CandidateRunner = hostRunner, extraMounts: Mount[] = []): HeldOutResult {
  const io = makeTempDir("io-");
  const input = join(io, "input.json");
  const output = join(io, "output.csv");
  const wire = orders.map(({ kind: _kind, ...wireFields }) => wireFields);
  writeFileSync(input, JSON.stringify(wire, null, 2));
  const [cmd, ...args] = command.map((part) => part.replace("{input}", input).replace("{output}", output));
  const home = makeTempDir("home-");
  const proc = runner(cmd, args, {
    cwd: candidateDir,
    env: sandboxEnv(home),
    timeoutMs,
    mounts: [...[candidateDir, io, home].map((d) => ({ host: d, container: d })), ...extraMounts],
  });

  const expectedLines = ["id,currency,amount", ...orders.map((o) => `${o.order_ref},${o.ccy},${formatMinorUnits(o.amount, o.ccy)}`)];
  const raw = existsSync(output) ? readFileSync(output, "utf8") : null;
  const actualLines = raw === null ? [] : raw.replace(/\n$/, "").split("\n");
  const headerOk = actualLines[0] === expectedLines[0];
  const rows = orders.map((o, i): HeldOutRow => {
    const expected = expectedLines[i + 1];
    const actual = actualLines[i + 1] ?? null;
    return { id: o.order_ref, kind: o.kind, ok: actual === expected, expected, actual };
  });
  const extraLines = Math.max(0, actualLines.length - expectedLines.length);
  const passed = rows.filter((r) => r.ok).length;
  return {
    ran: true,
    exitCode: proc.code,
    timedOut: proc.timedOut,
    headerOk,
    rows,
    extraLines,
    exact: raw !== null && actualLines.length === expectedLines.length && actualLines.every((l, i) => l === expectedLines[i]),
    passed,
    total: rows.length,
    stderrTail: proc.stderr.split("\n").slice(-5).join("\n"),
  };
}
