import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/agents-pointers.js";
import { fixture } from "./fixture.js";

test("pointers that say when to read and resolve from their AGENTS.md pass", () => {
  assert.deepEqual(check(fixture("agents-pointers", "pass")), []);
});

test("a dead pointer and a pointer without a when condition each fail with the fix", () => {
  assert.deepEqual(check(fixture("agents-pointers", "fail")), [
    {
      path: "AGENTS.md",
      line: 3,
      column: 25,
      message: "pointer to `checks/missing.md`, which does not exist. Fix the path, relative to this AGENTS.md, or remove the pointer.",
    },
    {
      path: "AGENTS.md",
      line: 4,
      column: 10,
      message: 'pointer without a condition. Start the line with when to read it: "When you X, read Y".',
    },
    {
      path: "docs/AGENTS.md",
      line: 1,
      column: 24,
      message: "pointer to `GLOSSARY.md`, which does not exist. Fix the path, relative to this AGENTS.md, or remove the pointer.",
    },
  ]);
});
