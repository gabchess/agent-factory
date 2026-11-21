import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

test("the CLI reports a dash in an untracked file and exits 1", () => {
  const repo = mkdtempSync(join(tmpdir(), "no-dashes-"));
  execFileSync("git", ["init", "-q"], { cwd: repo });
  writeFileSync(join(repo, "note.md"), "fine\nbad \u2014 here\n");
  const run = spawnSync(process.execPath, [fileURLToPath(new URL("../checks/no-dashes.js", import.meta.url))], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^note\.md:2:5: em dash\./);
});
