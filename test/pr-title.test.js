import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check } from "../checks/pr-title.js";

const titles = (kind) => readFileSync(new URL(`./fixtures/pr-title/${kind}.txt`, import.meta.url), "utf8").split("\n").slice(0, -1);

test("titles in the Conventional Commits format pass", () => {
  assert.deepEqual(titles("pass").map(check), titles("pass").map(() => []));
});

test("each title that breaks the format fails with the fix", () => {
  const format = 'Write it as "<type>[(scope)][!]: <description>", for example "fix(checks): skip binary files".';
  const types = "Use one of build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test.";
  const scope = 'Write the scope as one lower case noun, such as "checks" or "templates", or leave it out.';
  const description = 'Put exactly one space after ": ", then the change in the imperative.';
  assert.deepEqual(titles("fail").map(check), [
    [format],
    [format],
    [format],
    [`type "feature" is unknown. ${types}`],
    [`type "Feat" is unknown. ${types}`],
    [`scope "" is not a noun. ${scope}`],
    [`scope "Checks" is not a noun. ${scope}`],
    [format],
    [`the description is missing. ${description}`],
    [`the description is missing. ${description}`],
  ]);
});
