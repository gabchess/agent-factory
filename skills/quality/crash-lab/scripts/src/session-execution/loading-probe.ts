import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../adapters/claude-code.ts";
import { DEMO_RULESET, type ClaudeCodeRuleset } from "../instruction-context/claude-code-rules.ts";
import { makeTempDir } from "../util/fs.ts";
import type { ProbeCheck } from "./sandbox-probe.ts";
import { docker, SANDBOX_IMAGE } from "./sandbox.ts";

const CAPTURE = fileURLToPath(new URL("../../sandbox/capture-api.mjs", import.meta.url));

type RulesetSource = "rootMemory" | "imports" | "localMemory" | "nestedMemory" | "agentsMd" | "llmsTxt" | "userMemory";

const SOURCES: { source: string; rule: RulesetSource; path: string; inHome?: boolean; text: string }[] = [
  { source: "root CLAUDE.md", rule: "rootMemory", path: "CLAUDE.md", text: "ROOT_CODEWORD_7Q. See @imported.md" },
  { source: "@import from root CLAUDE.md", rule: "imports", path: "imported.md", text: "IMPORT_CODEWORD_3K" },
  { source: "CLAUDE.local.md", rule: "localMemory", path: "CLAUDE.local.md", text: "LOCAL_CODEWORD_5M" },
  { source: "nested sub/CLAUDE.md", rule: "nestedMemory", path: "sub/CLAUDE.md", text: "NESTED_CODEWORD_2P" },
  { source: "AGENTS.md", rule: "agentsMd", path: "AGENTS.md", text: "AGENTS_CODEWORD_9X" },
  { source: "llms.txt", rule: "llmsTxt", path: "llms.txt", text: "LLMS_CODEWORD_8T" },
  { source: "user ~/.claude/CLAUDE.md", rule: "userMemory", path: ".claude/CLAUDE.md", inHome: true, text: "USER_CODEWORD_4W" },
];

export function expectedInFirstRequest(ruleset: ClaudeCodeRuleset): Record<string, boolean> {
  return Object.fromEntries(SOURCES.map((s) => [s.source, ruleset[s.rule] === "yes"]));
}

export interface LoadingReceipt {
  cliVersion: string;
  model: string | null;
  loaded: Record<string, boolean>;
  toolsSent: string[];
  initTools: string[];
  requests: number;
}

export function loadingProbe(model: string, cliVersion: string): { receipt: LoadingReceipt; checks: ProbeCheck[] } {
  const root = makeTempDir("loading-");
  const work = join(root, "w"), home = join(root, "h"), out = join(root, "o");
  for (const d of [work, home, out]) mkdirSync(d, { recursive: true });
  for (const s of SOURCES) {
    const p = join(s.inHome ? home : work, s.path);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, s.text + "\n");
  }
  for (const d of [work, home, out]) chmodSync(d, 0o777);
  docker(["run", "--rm", "--network", "none", "--user", "1000:1000", "--cap-drop", "ALL", "-e", `HOME=${home}`,
    "-e", "ANTHROPIC_API_KEY=sk-ant-loading-probe", "-e", "ANTHROPIC_BASE_URL=http://127.0.0.1:8099",
    "-v", `${work}:${work}`, "-v", `${home}:${home}`, "-v", `${out}:${out}`, "-v", `${CAPTURE}:/opt/capture-api.mjs:ro`, "-w", work,
    SANDBOX_IMAGE, "sh", "-c",
    `node /opt/capture-api.mjs ${out}/requests.jsonl & sleep 1; timeout 60 claude -p "Reply with OK." --model ${model} --output-format stream-json --verbose --max-turns 1 --tools ${TOOLS.join(",")} --strict-mcp-config --no-session-persistence > ${out}/stream.jsonl 2>&1; true`],
    120_000);
  const lines = existsSync(join(out, "requests.jsonl")) ? readFileSync(join(out, "requests.jsonl"), "utf8").trim().split("\n") : [];
  const posts = lines.map((l) => JSON.parse(l) as { method: string; url: string; body: string }).filter((r) => r.method === "POST" && r.url.startsWith("/v1/messages"));
  const first = posts[0]?.body ?? "";
  const body = first ? (JSON.parse(first) as { model?: string; tools?: { name: string }[] }) : {};
  const init = (existsSync(join(out, "stream.jsonl")) ? readFileSync(join(out, "stream.jsonl"), "utf8").split("\n") : [])
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .find((e) => e?.type === "system" && e?.subtype === "init");
  const receipt: LoadingReceipt = {
    cliVersion,
    model: body.model ?? null,
    loaded: Object.fromEntries(SOURCES.map((s) => [s.source, first.includes(s.text.split(".")[0])])),
    toolsSent: (body.tools ?? []).map((t) => t.name).sort(),
    initTools: [...(init?.tools ?? [])].sort(),
    requests: posts.length,
  };
  const expectLoaded = expectedInFirstRequest(DEMO_RULESET);
  const checks: ProbeCheck[] = [{ where: "loading", check: "model request captured", expected: ">= 1 request, no network", actual: `${posts.length} requests`, ok: posts.length > 0 }];
  for (const s of SOURCES) {
    const got = receipt.loaded[s.source];
    checks.push({ where: "loading", check: `${s.source} in the first model request`, expected: expectLoaded[s.source] ? "loaded" : "not loaded", actual: got ? "loaded" : "not loaded", ok: got === expectLoaded[s.source] });
  }
  checks.push({ where: "loading", check: "model in request", expected: model, actual: String(receipt.model), ok: receipt.model === model });
  const unexpected = receipt.initTools.filter((t) => !TOOLS.includes(t));
  checks.push({ where: "loading", check: "tools in session init", expected: TOOLS.slice().sort().join(", "), actual: receipt.initTools.join(", "), ok: unexpected.length === 0 && TOOLS.every((t) => receipt.initTools.includes(t)) });
  const sentExtra = receipt.toolsSent.filter((t) => !TOOLS.includes(t) && t !== "DeferredToolPlaceholder");
  checks.push({ where: "loading", check: "tools sent to the model", expected: "the allowlist (plus Claude Code's DeferredToolPlaceholder stub)", actual: receipt.toolsSent.join(", "), ok: sentExtra.length === 0 && TOOLS.every((t) => receipt.toolsSent.includes(t)) });
  return { receipt, checks };
}
