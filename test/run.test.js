import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RUN = fileURLToPath(new URL("../checks/run.js", import.meta.url));

function repo(t, files) {
  const root = mkdtempSync(join(tmpdir(), "checks-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const run = (cwd) => spawnSync(process.execPath, [RUN], { cwd, encoding: "utf8" });

test("a clean repo passes", (t) => {
  const result = run(repo(t, { "note.md": "fine\n" }));
  assert.equal(result.status, 0, result.stderr);
});

test("a finding in an untracked file fails with its path, line and column, skipping links and fixtures", (t) => {
  const root = repo(t, { "note.md": "fine\nbad \u2014 here\n", "test/fixtures/x/fail/dashed.md": "\u2014\n" });
  mkdirSync(join(root, "folder"));
  symlinkSync("folder", join(root, "folder-link"));
  symlinkSync("loop", join(root, "loop"));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^note\.md:2:5: em dash\./);
  assert.equal(result.stderr.trim().split("\n").length, 1);
});
