import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/dead-links.js";
import { fixture } from "./fixture.js";

test("links to files, folders, anchors and other sites pass, and code is not a link", () => {
  assert.deepEqual(check(fixture("dead-links", "pass")), []);
});

test("each link to a path that does not exist is reported with the fix", () => {
  const failures = check(fixture("dead-links", "fail"));
  assert.deepEqual(
    failures.map(({ path, line, column }) => [path, line, column]),
    [["README.md", 1, 9], ["README.md", 2, 33], ["README.md", 4, 1], ["README.md", 5, 33], ["docs/guide.md", 1, 26]],
  );
  assert.equal(failures[0].message, "dead link to `docs/missing.md`. Fix the path or remove the link.");
});
