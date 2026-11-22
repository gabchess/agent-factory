import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/adr-names.js";
import { fixture } from "./fixture.js";

test("numbered ADRs and the folder's own docs pass", () => {
  assert.deepEqual(check(fixture("adr-names", "pass")), []);
});

test("a decision without a number, in a subfolder, with an upper case extension, the template's 0000 or a reused number fails with the fix", () => {
  const misnamed = "not a numbered ADR. Rename it decisions/NNNN-title.md, starting from templates/adr/0000-title.md.";
  assert.deepEqual(check(fixture("adr-names", "fail")), [
    { path: "decisions/0000-copied.md", line: 1, message: misnamed },
    { path: "decisions/0004-a.md", line: 1, message: "ADR number 0004 is also used by decisions/0004-b.md. Give it the next free number." },
    { path: "decisions/0004-b.md", line: 1, message: "ADR number 0004 is also used by decisions/0004-a.md. Give it the next free number." },
    { path: "decisions/0005-upper.MD", line: 1, message: misnamed },
    {
      path: "decisions/2026/0003-nested.md",
      line: 1,
      message: "not a numbered ADR. Rename it decisions/NNNN-title.md, starting from templates/adr/0000-title.md.",
    },
    {
      path: "decisions/use-linear.md",
      line: 1,
      message: "not a numbered ADR. Rename it decisions/NNNN-title.md, starting from templates/adr/0000-title.md.",
    },
  ]);
});
