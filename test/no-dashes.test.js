import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findDashes } from "../checks/no-dashes.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/no-dashes/${name}`, import.meta.url), "utf8");

test("clean text has no findings", () => {
  assert.deepEqual(findDashes(fixture("clean.md")), []);
});

test("each em or en dash is reported with its line", () => {
  assert.deepEqual(
    findDashes(fixture("dashed.md")).map(({ line, dash }) => [line, dash]),
    [[2, "em dash"], [3, "en dash"]],
  );
});
