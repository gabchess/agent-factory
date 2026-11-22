import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inventoryClaudeCode } from "../instruction-context/inventory.ts";
import type { HarnessAdapter, RunOutcome, SessionStatus } from "./types.ts";

export interface CandidateFixture {
  name: string;
  arm: string;
  description: string;
  extends: string[];
  delete: string[];
  expect: { verdict: "pass" | "fail"; reasonIncludes: string[] };
}

export function loadFixture(fixturesDir: string, name: string): CandidateFixture {
  const raw = JSON.parse(readFileSync(join(fixturesDir, name, "fixture.json"), "utf8"));
  return { name, extends: [], delete: [], ...raw };
}

export function applyFixture(fixturesDir: string, name: string, workdir: string): void {
  if (!existsSync(join(fixturesDir, name, "fixture.json"))) {
    cpSync(join(fixturesDir, name), workdir, { recursive: true });
    return;
  }
  const fixture = loadFixture(fixturesDir, name);
  for (const parent of fixture.extends) applyFixture(fixturesDir, parent, workdir);
  const files = join(fixturesDir, name, "files");
  if (existsSync(files)) cpSync(files, workdir, { recursive: true });
  for (const path of fixture.delete) rmSync(join(workdir, path), { force: true });
}

export interface ScriptedAttempt {
  status: SessionStatus;
  fixture?: string;
  costUsd: number;
  turns: number;
  claim: "success" | "failure" | "none";
}

export function fakeAdapter(fixturesDir: string, script: Record<string, ScriptedAttempt[]>, opts: { transcriptDir?: string } = {}): HarnessAdapter {
  const calls = new Map<string, number>();
  const dir = resolve(fixturesDir);
  return {
    id: "fake",
    live: false,
    async version() {
      return { harness: "fake", cliVersion: "offline", model: "none" };
    },
    discover(repoDir, home) {
      return inventoryClaudeCode(repoDir, { home });
    },
    async run(req): Promise<RunOutcome> {
      const n = calls.get(req.slotKey) ?? 0;
      calls.set(req.slotKey, n + 1);
      const attempts = script[req.slotKey];
      const attempt = attempts?.[Math.min(n, attempts.length - 1)];
      if (!attempt) throw new Error(`fake adapter: no script for ${req.slotKey}`);
      if (attempt.status === "completed" && attempt.fixture) applyFixture(dir, attempt.fixture, req.workdir);
      let transcriptPath: string | null = null;
      if (opts.transcriptDir) {
        mkdirSync(opts.transcriptDir, { recursive: true });
        transcriptPath = join(opts.transcriptDir, `${req.slotKey.replace(/:/g, "_")}-${n + 1}.jsonl`);
        writeFileSync(transcriptPath, JSON.stringify({ type: "result", subtype: "scripted", fixture: attempt.fixture ?? null }) + "\n");
      }
      return {
        status: attempt.status,
        usage: { costUsd: attempt.costUsd, inputTokens: "unknown", outputTokens: "unknown", cacheReadTokens: "unknown", turns: attempt.turns, wallMs: 0 },
        finalClaim: attempt.claim,
        transcriptPath,
      };
    },
  };
}
