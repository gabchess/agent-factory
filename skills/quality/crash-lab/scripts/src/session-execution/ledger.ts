import { closeSync, existsSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";

export interface LedgerEntry {
  id: number;
  slot: string;
  attempt: number;
  reservedUsd: number;
  chargedUsd: number | null;
  costKnown: boolean | null;
  reportedUsd?: number | null;
  runId?: string;
  experiment?: string;
  at: string;
}

export interface ReservationScope {
  runId?: string;
  experiment?: string;
  experimentCapUsd?: number;
}

export class BudgetLedger {
  readonly capUsd: number;
  private entries: LedgerEntry[];
  private readonly path: string | null;
  private readonly lockPath: string | null;

  private constructor(capUsd: number, entries: LedgerEntry[], path: string | null) {
    this.capUsd = capUsd;
    this.entries = entries;
    this.path = path;
    this.lockPath = path ? `${path}.lock` : null;
  }

  static memory(capUsd: number): BudgetLedger {
    return new BudgetLedger(capUsd, [], null);
  }

  static open(path: string, capUsd: number): BudgetLedger {
    const lockPath = `${path}.lock`;
    let fd: number;
    try {
      fd = openSync(lockPath, "wx");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw new Error(`ledger lock ${lockPath} could not be created: ${(err as Error).message}`, { cause: err });
      fd = recoverAbandonedLock(path, lockPath);
    }
    try {
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      const stored = existsSync(path) ? parseStoredLedger(path, readFileSync(path, "utf8")) : null;
      if (stored && stored.capUsd !== capUsd) throw new Error(`ledger cap ${stored.capUsd} differs from experiment cap ${capUsd}`);
      const entries = (stored?.entries ?? []).map((e) => (e.chargedUsd === null ? { ...e, chargedUsd: e.reservedUsd, costKnown: false } : e));
      const ledger = new BudgetLedger(capUsd, entries, path);
      ledger.persist();
      return ledger;
    } catch (err) {
      unlinkSync(lockPath);
      throw err;
    }
  }

  close(): void {
    if (this.lockPath && existsSync(this.lockPath)) unlinkSync(this.lockPath);
  }

  get spentUsd(): number {
    return this.entries.reduce((s, e) => s + (e.chargedUsd ?? 0), 0);
  }

  get reportedUsd(): number {
    return this.entries.reduce((s, e) => s + (typeof e.reportedUsd === "number" ? e.reportedUsd : 0), 0);
  }

  get reservedUsd(): number {
    return this.entries.reduce((s, e) => s + (e.chargedUsd === null ? e.reservedUsd : 0), 0);
  }

  get attempts(): number {
    return this.entries.length;
  }

  get headroomUsd(): number {
    return this.capUsd - this.spentUsd - this.reservedUsd;
  }

  committedUsdFor(experiment: string): number {
    return this.entries.filter((e) => e.experiment === experiment).reduce((s, e) => s + (e.chargedUsd ?? e.reservedUsd), 0);
  }

  spentUsdFor(experiment: string): number {
    return this.entries.filter((e) => e.experiment === experiment).reduce((s, e) => s + (e.chargedUsd ?? 0), 0);
  }

  headroomUsdFor(scope: ReservationScope): number {
    if (scope.experiment === undefined || scope.experimentCapUsd === undefined) return this.headroomUsd;
    return Math.min(this.headroomUsd, scope.experimentCapUsd - this.committedUsdFor(scope.experiment));
  }

  reserve(slot: string, attempt: number, amountUsd: number, scope: ReservationScope = {}): number | null {
    if (amountUsd > this.headroomUsdFor(scope) + 1e-9) return null;
    const id = this.entries.length;
    const { runId, experiment } = scope;
    this.entries.push({ id, slot, attempt, reservedUsd: amountUsd, chargedUsd: null, costKnown: null, ...(runId ? { runId } : {}), ...(experiment !== undefined ? { experiment } : {}), at: new Date().toISOString() });
    this.persist();
    return id;
  }

  charge(id: number, actualUsd: number | "unknown", reportedUsd?: number | "unknown"): number {
    const e = this.entries[id];
    if (!e || e.chargedUsd !== null) throw new Error(`reservation ${id} is not open`);
    e.costKnown = actualUsd !== "unknown";
    if (reportedUsd !== undefined) e.reportedUsd = reportedUsd === "unknown" ? null : reportedUsd;
    e.chargedUsd = actualUsd === "unknown" ? e.reservedUsd : actualUsd;
    this.persist();
    return e.chargedUsd;
  }

  snapshot(): { capUsd: number; spentUsd: number; reportedUsd: number; attempts: number; headroomUsd: number; entries: LedgerEntry[] } {
    return { capUsd: this.capUsd, spentUsd: this.spentUsd, reportedUsd: this.reportedUsd, attempts: this.attempts, headroomUsd: this.headroomUsd, entries: this.entries.map((e) => ({ ...e })) };
  }

  private persist(): void {
    if (!this.path) return;
    const tmp = `${this.path}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify({ capUsd: this.capUsd, entries: this.entries }, null, 2));
    renameSync(tmp, this.path);
  }
}

const isUsd = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

function parseStoredLedger(path: string, text: string): { capUsd: number; entries: LedgerEntry[] } {
  const data: unknown = JSON.parse(text);
  const shape = data as { capUsd?: unknown; entries?: unknown } | null;
  if (!shape || !isUsd(shape.capUsd) || !Array.isArray(shape.entries)) throw new Error(`ledger ${path} is not a ledger: needs a non-negative capUsd and an entries array`);
  shape.entries.forEach((e: Partial<LedgerEntry> | null, i) => {
    const ok = e && Number.isInteger(e.id) && typeof e.slot === "string" && isUsd(e.reservedUsd) && (e.chargedUsd === null || isUsd(e.chargedUsd)) && (e.reportedUsd == null || isUsd(e.reportedUsd));
    if (!ok) throw new Error(`ledger ${path} entry ${i} needs an integer id, a slot, a non-negative reservedUsd, and non-negative or null chargedUsd and reportedUsd`);
  });
  return { capUsd: shape.capUsd, entries: shape.entries as LedgerEntry[] };
}

function lockOwnerAlive(lockPath: string): boolean {
  const pid = Number(readFileSync(lockPath, "utf8").trim());
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function recoverAbandonedLock(path: string, lockPath: string): number {
  const locked = new Error(`ledger ${path} is locked by another runner`);
  const recoveryPath = `${lockPath}.recovery`;
  let recovery: number;
  try {
    recovery = openSync(recoveryPath, "wx");
  } catch {
    if (!existsSync(recoveryPath) || lockOwnerAlive(recoveryPath)) throw locked;
    unlinkSync(recoveryPath);
    try {
      recovery = openSync(recoveryPath, "wx");
    } catch {
      throw locked;
    }
  }
  try {
    writeFileSync(recovery, String(process.pid));
    if (existsSync(lockPath) && lockOwnerAlive(lockPath)) throw locked;
    if (existsSync(lockPath)) unlinkSync(lockPath);
    try {
      return openSync(lockPath, "wx");
    } catch {
      throw locked;
    }
  } finally {
    closeSync(recovery);
    unlinkSync(recoveryPath);
  }
}
