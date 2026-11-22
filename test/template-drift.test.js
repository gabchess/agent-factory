import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/template-drift.js";
import { fixture } from "./fixture.js";

test("artifacts with their template's frontmatter keys and sections in order pass, extras allowed", () => {
  assert.deepEqual(check(fixture("template-drift", "pass")), []);
});

test("an artifact that drifts from its template fails with the fix", () => {
  const skill = "templates/skill/SKILL.md";
  const adr = "templates/adr/0000-title.md";
  const listing = "templates/listing/LISTING.md";
  const key = (name, template) => `missing frontmatter key "${name}" that ${template} has. Add it.`;
  const section = (heading, template, order) =>
    `missing section "${heading}" that ${template} has. Add it so the sections run: ${order}.`;
  assert.deepEqual(check(fixture("template-drift", "fail")), [
    {
      path: "agents/x/scout/AGENT.md",
      line: 1,
      message: "no template at templates/agent/AGENT.md for this agent. Restore the template before adding agents.",
    },
    { path: "decisions/0002-no-evidence.md", line: 1, message: section("## Evidence", adr, "## Why, ## Evidence") },
    { path: "skills/a/empty-description/SKILL.md", line: 3, message: `frontmatter key "description" is empty. Fill it in the way ${skill} shows.` },
    { path: "skills/a/missing-section/LISTING.md", line: 1, message: section("## Demo", listing, "## Card, ## Demo") },
    { path: "skills/a/missing-section/SKILL.md", line: 1, message: section("## Background", skill, "## Steps, ## Background") },
    { path: "skills/a/no-description/SKILL.md", line: 1, message: key("description", skill) },
    { path: "skills/a/no-frontmatter/SKILL.md", line: 1, message: key("name", skill) },
    { path: "skills/a/no-frontmatter/SKILL.md", line: 1, message: key("description", skill) },
    { path: "skills/a/null-description/SKILL.md", line: 3, message: `frontmatter key "description" is empty. Fill it in the way ${skill} shows.` },
    {
      path: "skills/a/out-of-order/SKILL.md",
      line: 5,
      message: `section "## Background" is out of order. ${skill} runs: ## Steps, ## Background.`,
    },
    { path: "skills/a/renamed/SKILL.md", line: 1, message: section("## Background", skill, "## Steps, ## Background") },
  ]);
});
