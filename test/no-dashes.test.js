import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/no-dashes.js";
import { fixture } from "./fixture.js";

test("text without dashes passes", () => {
  assert.deepEqual(check(fixture("no-dashes", "pass")), []);
});

test("each em dash, en dash and spaced hyphen in prose is reported with its line and fix", () => {
  const failures = check(fixture("no-dashes", "fail"));
  assert.deepEqual(
    failures.map(({ path, line, column }) => [path, line, column]),
    [["dashed.md", 2, 25], ["dashed.md", 3, 28], ["dashed.md", 4, 34]],
  );
  assert.match(failures[0].message, /^em dash\. Rewrite the sentence with a comma, colon, period or parentheses/);
  assert.match(failures[2].message, /^hyphen used as a dash\. Rewrite/);
});
