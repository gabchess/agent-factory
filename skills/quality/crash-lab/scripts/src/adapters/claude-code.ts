import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { finished } from "node:stream/promises";
import { inventoryClaudeCode } from "../instruction-context/inventory.ts";
import { containerName, INTERNAL_NETWORK, runArgs, SANDBOX_IMAGE, sessionEnv, sessionMounts } from "../session-execution/sandbox.ts";
import { chargeFor, type PriceTable } from "../session-execution/pricing.ts";
import type { HarnessAdapter, HarnessVersion, ObservedSession, RunOutcome, RunRequest, Usage } from "./types.ts";

export interface ClaudeCodeOptions {
  bin: string;
  path: string;
  apiKey: string;
  transcriptDir: string;
  pinnedVersion: string;
  sandbox?: boolean;
  pricing?: PriceTable;
}

export const TOOLS = ["Bash", "Read", "Edit", "Write", "Glob", "Grep"];
const CREDIT_PATTERNS = [/credit balance is too low/i, /insufficient.?credit/i, /billing/i, /quota/i];

export function claudeCodeAdapter(opts: ClaudeCodeOptions): HarnessAdapter {
  return {
    id: "claude-code",
    live: true,
    async version(): Promise<HarnessVersion> {
      const v = opts.sandbox
        ? await capture("docker", ["run", "--rm", "--network", "none", SANDBOX_IMAGE, "claude", "--version"], process.env)
        : await capture(opts.bin, ["--version"], { PATH: opts.path, HOME: "/tmp" });
      const cliVersion = v.split(" ")[0] || "unknown";
      if (cliVersion !== opts.pinnedVersion) throw new Error(`claude-code ${cliVersion} is not the pinned ${opts.pinnedVersion}`);
      return { harness: "claude-code", cliVersion, model: "pinned-per-run" };
    },
    discover(repoDir, home) {
      return inventoryClaudeCode(repoDir, { home });
    },
    run: (req) => runClaude(opts, req),
  };
}

async function runClaude(opts: ClaudeCodeOptions, req: RunRequest): Promise<RunOutcome> {
  const transcriptPath = `${opts.transcriptDir}/${req.slotKey.replace(/:/g, "_")}-${Date.now()}.jsonl`;
  mkdirSync(dirname(transcriptPath), { recursive: true });
  const args = [
    "-p", req.prompt,
    "--model", req.model,
    "--output-format", "stream-json", "--verbose",
    "--max-turns", String(req.maxTurns),
    "--max-budget-usd", String(req.maxCostUsd),
    "--permission-mode", "bypassPermissions",
    "--tools", TOOLS.join(","),
    "--allowedTools", ...TOOLS,
    "--disallowedTools", "WebFetch", "WebSearch", "Task",
    "--strict-mcp-config",
    "--no-session-persistence",
  ];
  const started = Date.now();
  const out = createWriteStream(transcriptPath);
  const transcriptClosed = finished(out, { cleanup: true }).then(() => null, (error: Error) => error);
  let result: Record<string, unknown> | null = null;
  let stderr = "";
  let spawnError: string | null = null;
  const observed: ObservedSession = { initModel: null, initTools: [], models: {}, toolCalls: {} };
  let buffer = "";
  const { timedOut, wallMs } = await new Promise<{ timedOut: boolean; wallMs: number }>((resolve) => {
    const name = containerName("session");
    const child = opts.sandbox
      ? spawn("docker", [...runArgs({ name, network: INTERNAL_NETWORK, mounts: sessionMounts(req.workdir, req.home), env: sessionEnv(), workdir: "/work" }), "claude", ...args], {
          env: { PATH: process.env.PATH, HOME: process.env.HOME, ANTHROPIC_API_KEY: opts.apiKey },
          stdio: ["ignore", "pipe", "pipe"],
        })
      : spawn(opts.bin, args, {
          cwd: req.workdir,
          env: { PATH: opts.path, HOME: req.home, ANTHROPIC_API_KEY: opts.apiKey, LANG: "C.UTF-8", NO_COLOR: "1" },
          stdio: ["ignore", "pipe", "pipe"],
        });
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      if (opts.sandbox) spawn("docker", ["rm", "-f", name], { stdio: "ignore" });
      child.kill("SIGKILL");
    }, req.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      if (!out.destroyed) out.write(chunk);
      buffer += chunk.toString("utf8");
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        try {
          const ev = JSON.parse(line) as Record<string, unknown>;
          if (ev.type === "result") result = ev;
          const msg = ev.message as { model?: string; content?: { type: string; name?: string }[] } | undefined;
          if (ev.type === "system" && ev.subtype === "init") {
            observed.initModel = String(ev.model ?? "");
            observed.initTools = Array.isArray(ev.tools) ? (ev.tools as string[]) : [];
          }
          if (ev.type === "assistant" && msg) {
            if (msg.model) observed.models[msg.model] = (observed.models[msg.model] ?? 0) + 1;
            for (const c of msg.content ?? []) if (c.type === "tool_use" && c.name) observed.toolCalls[c.name] = (observed.toolCalls[c.name] ?? 0) + 1;
          }
        } catch {
        }
      }
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr = (stderr + c.toString("utf8")).slice(-4000);
    });
    child.on("error", (err) => {
      spawnError = err.message;
    });
    child.on("close", () => {
      clearTimeout(timer);
      const wallMs = Date.now() - started;
      if (!out.destroyed) out.end();
      resolve({ timedOut: killed, wallMs });
    });
  });
  const transcriptError = await transcriptClosed;
  const r = result as Record<string, any> | null;
  const usage: Usage = {
    costUsd: chargeFor(typeof r?.total_cost_usd === "number" ? r.total_cost_usd : "unknown", r?.usage ?? null, opts.pricing),
    reportedCostUsd: typeof r?.total_cost_usd === "number" ? r.total_cost_usd : "unknown",
    cacheWriteTokens: r?.usage?.cache_creation_input_tokens ?? "unknown",
    inputTokens: r?.usage?.input_tokens ?? "unknown",
    outputTokens: r?.usage?.output_tokens ?? "unknown",
    cacheReadTokens: r?.usage?.cache_read_input_tokens ?? "unknown",
    turns: typeof r?.num_turns === "number" ? r.num_turns : "unknown",
    wallMs,
  };
  const text = `${typeof r?.result === "string" ? r.result : ""}\n${stderr}`;
  const brief = (s: string): string => s.trim().slice(0, 300);
  const ended = (status: RunOutcome["status"], error?: string, path: string | null = transcriptPath): RunOutcome =>
    ({ status, usage, finalClaim: "none", transcriptPath: path, error, observed });
  if (transcriptError) return ended("harness_error", `failed to write transcript: ${transcriptError.message}`, null);
  if (spawnError) return ended("harness_error", `failed to start: ${spawnError}`);
  const disallowed = observed.initTools.filter((t) => !TOOLS.includes(t));
  if (timedOut) return ended("timeout");
  if (CREDIT_PATTERNS.some((p) => p.test(text)) && (!r || r.is_error)) return ended("credit_exhausted", brief(text));
  if (!r) return ended("harness_error", stderr.trim().slice(-300) || "no result event");
  if (r.subtype === "error_max_turns" || r.subtype === "error_max_budget_usd") return ended("budget_exceeded", String(r.subtype));
  if (r.is_error || r.subtype !== "success") return ended("harness_error", `${r.subtype}: ${brief(text)}`);
  if (disallowed.length) return ended("harness_error", `session exposed tools outside the allowlist: ${disallowed.join(", ")}`);
  return { status: "completed", usage, finalClaim: "success", transcriptPath, observed };
}

function capture(bin: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const c = spawn(bin, args, { env });
    let s = "";
    c.stdout.on("data", (d: Buffer) => (s += d.toString()));
    c.on("error", (err) => reject(new Error(`${bin} ${args.join(" ")} could not run: ${err.message}`)));
    c.on("close", () => resolve(s.trim()));
  });
}
