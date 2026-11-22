import { posix } from "node:path";

export const SKILL = { name: "skill", template: "templates/skill/SKILL.md", pattern: /^skills\/.+\/SKILL\.md$/ };
export const AGENT = { name: "agent", template: "templates/agent/AGENT.md", pattern: /^agents\/.+\/AGENT\.md$/ };
export const ADR = { name: "ADR", template: "templates/adr/0000-title.md", pattern: /^decisions\/\d{4}-[^/]+\.md$/ };
export const MCP_CONTRACT = { name: "MCP contract", template: "templates/mcp-contract/CONTRACT.md", pattern: /^tools\/.+\/CONTRACT\.md$/ };

export const LISTING = { name: "listing", template: "templates/listing/LISTING.md", pattern: /^skills\/.+\/LISTING\.md$/ };

export const TEMPLATED = [SKILL, AGENT, ADR, MCP_CONTRACT, LISTING];

export const isA = (kind) => ({ path }) => kind.pattern.test(path);
export const isAgentsFile = ({ path }) => posix.basename(path) === "AGENTS.md";
export const isInstructionFile = ({ path }) => ["AGENTS.md", "CLAUDE.md"].includes(posix.basename(path));
