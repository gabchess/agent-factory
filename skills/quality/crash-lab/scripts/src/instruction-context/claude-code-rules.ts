export type ApplyRule = "yes" | "no" | "on-demand" | "unknown" | "documentation";

export interface ClaudeCodeRuleset {
  id: string;
  verifiedVersions: string[];
  rootMemory: ApplyRule;
  nestedMemory: ApplyRule;
  localMemory: ApplyRule;
  userMemory: ApplyRule;
  imports: ApplyRule;
  agentsMd: ApplyRule;
  skills: ApplyRule;
  agents: ApplyRule;
  llmsTxt: ApplyRule;
  notes: string[];
}

export const DEMO_RULESET: ClaudeCodeRuleset = {
  id: "claude-code/demo-root-only",
  verifiedVersions: ["2.1.329"],
  rootMemory: "yes",
  nestedMemory: "on-demand",
  localMemory: "yes",
  userMemory: "yes",
  imports: "yes",
  agentsMd: "no",
  skills: "on-demand",
  agents: "on-demand",
  llmsTxt: "documentation",
  notes: [
    "Probed on 2.1.329 by `crashlab sandbox-probe` (headless -p, request captured by a local stand-in API, receipt in docs/sandbox-probe/loading-receipt.json): root CLAUDE.md, its @ imports, CLAUDE.local.md and ~/.claude/CLAUDE.md reach the first model request; AGENTS.md, llms.txt and a nested CLAUDE.md do not (nested loads on demand).",
    "The audit forbids CLAUDE.local.md and imports in demo arms, and every session gets a fresh, empty HOME, so only root CLAUDE.md applies.",
    "Skills and agents are on-demand by documentation, not probed; demo arms contain none.",
    "Any other CLI version is unverified: re-run the probe before using it.",
    "llms.txt is documentation, never an instruction layer.",
  ],
};
