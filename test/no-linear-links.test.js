import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/no-linear-links.js";
import { fixture } from "./fixture.js";

test("text that names Linear without linking to it passes", () => {
  assert.deepEqual(check(fixture("no-linear-links", "pass")), []);
});

test("a link to Linear in any file fails with the fix", () => {
  const failures = check(fixture("no-linear-links", "fail"));
  assert.deepEqual(
    failures.map(({ path, line, column }) => [path, line, column]),
    [["config.js", 1, 24], ["notes.md", 3, 28]],
  );
  assert.equal(failures[0].message, "link to Linear. Linear links to this repo, never the reverse. Keep the context here and remove the link.");
});
