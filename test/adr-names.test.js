import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/adr-names.js";
import { fixture } from "./fixture.js";

test("numbered ADRs and the folder's own docs pass", () => {
  assert.deepEqual(check(fixture("adr-names", "pass")), []);
});

test("a decision without a number fails with the fix", () => {
  assert.deepEqual(check(fixture("adr-names", "fail")), [
    {
      path: "decisions/use-linear.md",
      line: 1,
      message: "not a numbered ADR. Rename it decisions/NNNN-title.md, starting from templates/adr/0000-title.md.",
    },
  ]);
});
