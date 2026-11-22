import type { Inventory } from "../instruction-context/inventory.ts";

export interface HarnessVersion {
  harness: string;
  cliVersion: string | "unknown";
  model: string | "unknown";
}

export interface RunRequest {
  workdir: string;
  home: string;
  prompt: string;
  model: string;
  maxTurns: number;
  timeoutMs: number;
  maxCostUsd: number;
  slotKey: string;
}

export type SessionStatus = "completed" | "timeout" | "budget_exceeded" | "harness_error" | "credit_exhausted";

export interface Usage {
  costUsd: number | "unknown";
  inputTokens: number | "unknown";
  outputTokens: number | "unknown";
  cacheReadTokens: number | "unknown";
  cacheWriteTokens?: number | "unknown";
  reportedCostUsd?: number | "unknown";
  turns: number | "unknown";
  wallMs: number;
}

export interface ObservedSession {
  initModel: string | null;
  initTools: string[];
  models: Record<string, number>;
  toolCalls: Record<string, number>;
}

export interface RunOutcome {
  status: SessionStatus;
  observed?: ObservedSession;
  usage: Usage;
  finalClaim: "success" | "failure" | "none";
  transcriptPath: string | null;
  error?: string;
}

export interface HarnessAdapter {
  id: string;
  live: boolean;
  version(): Promise<HarnessVersion>;
  discover(repoDir: string, home: string): Inventory;
  run(req: RunRequest): Promise<RunOutcome>;
}
