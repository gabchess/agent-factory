import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/adr-length.js";
import { fixture } from "./fixture.js";

test("an ADR of 60 lines passes, and the folder README is not an ADR", () => {
  assert.deepEqual(check(fixture("adr-length", "pass")), []);
});

test("an ADR over 60 lines fails at its 61st line with the fix", () => {
  assert.deepEqual(check(fixture("adr-length", "fail")), [
    {
      path: "decisions/0001-long.md",
      line: 61,
      message: "ADR has 61 lines, over the limit of 60. Split it into two decisions or move the background out.",
    },
  ]);
});
