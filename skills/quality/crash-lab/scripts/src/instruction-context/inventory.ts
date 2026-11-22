import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { listFiles } from "../util/fs.ts";
import { DEMO_RULESET, type ApplyRule, type ClaudeCodeRuleset } from "./claude-code-rules.ts";

export type SourceKind = "memory" | "nested-memory" | "local-memory" | "user-memory" | "import" | "agents-md" | "skill" | "agent" | "settings" | "llms-txt";

export interface InstructionSource {
  path: string;
  kind: SourceKind;
  found: boolean;
  shouldApply: ApplyRule;
  observedLoaded: "yes" | "no" | "unknown";
  actedOn: "yes" | "no" | "unknown";
}

export interface Inventory {
  harness: "claude-code";
  ruleset: string;
  rulesetVerifiedVersions: string[];
  sources: InstructionSource[];
  notes: string[];
}

const MAX_IMPORT_HOPS = 4;

export function inventoryClaudeCode(repoDir: string, opts: { home?: string; ruleset?: ClaudeCodeRuleset } = {}): Inventory {
  const rules = opts.ruleset ?? DEMO_RULESET;
  const sources: InstructionSource[] = [];
  const add = (path: string, kind: SourceKind, shouldApply: ApplyRule): void => {
    sources.push({ path, kind, found: true, shouldApply, observedLoaded: "unknown", actedOn: "unknown" });
  };

  for (const file of listFiles(repoDir)) {
    const base = file.split("/").pop() ?? file;
    if (file === "CLAUDE.md" || file === ".claude/CLAUDE.md") add(file, "memory", rules.rootMemory);
    else if (base === "CLAUDE.md") add(file, "nested-memory", rules.nestedMemory);
    else if (base === "CLAUDE.local.md") add(file, "local-memory", rules.localMemory);
    else if (base === "AGENTS.md") add(file, "agents-md", rules.agentsMd);
    else if (/^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(file)) add(file, "skill", rules.skills);
    else if (/^\.claude\/agents\/[^/]+\.md$/.test(file)) add(file, "agent", rules.agents);
    else if (/^\.claude\/settings(\.local)?\.json$/.test(file)) add(file, "settings", "yes");
    else if (/^llms(-full)?\.txt$/.test(base)) add(file, "llms-txt", rules.llmsTxt);
  }

  if (opts.home) {
    const user = join(opts.home, ".claude", "CLAUDE.md");
    if (existsSync(user)) add(user, "user-memory", rules.userMemory);
  }

  const queue = sources
    .filter((src) => ["memory", "nested-memory", "local-memory", "user-memory"].includes(src.kind))
    .map((src) => ({ path: src.path, absolute: src.kind === "user-memory", applies: src.shouldApply, hops: 0 }));
  const visited = new Set(queue.map((q) => `${q.absolute}:${q.path}`));
  while (queue.length > 0) {
    const from = queue.shift()!;
    const abs = from.absolute ? from.path : join(repoDir, from.path);
    for (const imp of parseImports(readFileSync(abs, "utf8"))) {
      const target = from.absolute ? join(dirname(abs), imp) : normalize(join(dirname(from.path), imp));
      const key = `${from.absolute}:${target}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const exists = existsSync(from.absolute ? target : join(repoDir, target));
      const applies: ApplyRule = !exists ? "no" : from.applies === "yes" ? rules.imports : from.applies;
      sources.push({ path: target, kind: "import", found: exists, shouldApply: applies, observedLoaded: "unknown", actedOn: "unknown" });
      if (exists && from.hops + 1 < MAX_IMPORT_HOPS) queue.push({ path: target, absolute: from.absolute, applies, hops: from.hops + 1 });
    }
  }

  return { harness: "claude-code", ruleset: rules.id, rulesetVerifiedVersions: rules.verifiedVersions, sources, notes: rules.notes };
}

export function parseImports(markdown: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const stripped = line.replace(/`[^`]*`/g, "");
    for (const m of stripped.matchAll(/(?:^|\s)@([\w./~-]*\w)/g)) out.push(m[1]);
  }
  return out;
}
