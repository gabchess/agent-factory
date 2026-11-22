import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/skill-names.js";
import { fixture } from "./fixture.js";

test("skills with distinct names and folders pass", () => {
  assert.deepEqual(check(fixture("skill-names", "pass")), []);
});

test("two skills sharing a name or a folder name, in any case, quoted or with CRLF, each fail with the fix", () => {
  const fix = (name, other) => `skill name "${name}" is also used by ${other}. Harnesses link skills flat by name, so rename one.`;
  assert.deepEqual(check(fixture("skill-names", "fail")), [
    { path: "skills/a/tdd/SKILL.md", line: 1, message: fix("tdd", "skills/b/tdd/SKILL.md") },
    { path: "skills/b/tdd/SKILL.md", line: 2, message: fix("tdd", "skills/a/tdd/SKILL.md") },
    { path: "skills/c/plan/SKILL.md", line: 2, message: fix("design", "skills/d/design/SKILL.md") },
    { path: "skills/d/design/SKILL.md", line: 1, message: fix("design", "skills/c/plan/SKILL.md") },
    { path: "skills/e/Ship/SKILL.md", line: 1, message: fix("Ship", "skills/f/ship/SKILL.md") },
    { path: "skills/f/ship/SKILL.md", line: 1, message: fix("ship", "skills/e/Ship/SKILL.md") },
    { path: "skills/reviews/code-review/SKILL.md", line: 2, message: fix("code-review", "skills/utilities/review/SKILL.md") },
    { path: "skills/utilities/review/SKILL.md", line: 2, message: fix("code-review", "skills/reviews/code-review/SKILL.md") },
    { path: "skills/x/lint/SKILL.md", line: 1, message: fix("lint", "skills/y/lint/SKILL.md") },
    { path: "skills/y/lint/SKILL.md", line: 1, message: fix("lint", "skills/x/lint/SKILL.md") },
  ]);
});
