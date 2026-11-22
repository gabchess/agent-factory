import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { check, render } from "../checks/instruction-snapshot.js";
import { createRepo } from "../checks/repo.js";
import { fixture } from "./fixture.js";

const SNAPSHOT = "data/instructions.snapshot";
const repoOf = (files) => createRepo(Object.keys(files), (path) => files[path]);

test("a snapshot that matches the AGENTS.md files, skills and tool contracts passes", () => {
  assert.deepEqual(check(fixture("instruction-snapshot", "pass")), []);
});

test("a stale snapshot fails at its first stale line with the fix", () => {
  assert.deepEqual(check(fixture("instruction-snapshot", "fail")), [
    { path: SNAPSHOT, line: 15, message: "snapshot is stale from this line. Run `npm run snapshot` and commit the result." },
  ]);
});

test("a snapshot checked out with CRLF line endings still matches", () => {
  const repo = fixture("instruction-snapshot", "pass");
  const crlf = repo.files.map((file) => (file.path === SNAPSHOT ? { ...file, text: file.text.replace(/\n/g, "\r\n") } : file));
  assert.deepEqual(check({ ...repo, files: crlf }), []);
});

test("a nested CLAUDE.md is part of what an agent loads", () => {
  const text = render(repoOf({ "AGENTS.md": "# root\n", "skills/CLAUDE.md": "Skill folder rule.\n" }));
  assert.match(text, /## skills\/CLAUDE\.md\n\nSkill folder rule\./);
  assert.match(render(repoOf({ "CLAUDE.md": "    @AGENTS.md\n" })), /## CLAUDE\.md\n\n {4}@AGENTS\.md\n/);
});

test("a missing snapshot fails, and a repo with nothing an agent loads needs none", () => {
  assert.deepEqual(check(repoOf({ "AGENTS.md": "# root\n" })), [
    { path: SNAPSHOT, line: 1, message: "snapshot is missing. Run `npm run snapshot` and commit the result." },
  ]);
  assert.deepEqual(check(repoOf({ "README.md": "# readme\n" })), []);
});

test("npm run snapshot writes a snapshot that then passes", (t) => {
  const root = mkdtempSync(join(tmpdir(), "snapshot-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: root });
  writeFileSync(join(root, "AGENTS.md"), "# root\n");
  mkdirSync(join(root, "data"));
  writeFileSync(join(root, SNAPSHOT), "old\n");
  const write = spawnSync(process.execPath, [fileURLToPath(new URL("../checks/write-snapshot.js", import.meta.url))], { cwd: root, encoding: "utf8" });
  assert.equal(write.status, 0, write.stderr);
  const text = readFileSync(join(root, SNAPSHOT), "utf8");
  assert.match(text, /^# Instructions an agent loads\n/);
  assert.deepEqual(check(repoOf({ "AGENTS.md": "# root\n", [SNAPSHOT]: text })), []);
});
