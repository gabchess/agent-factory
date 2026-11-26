import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKS = fileURLToPath(new URL("../checks/", import.meta.url));
const slash = (path) => path.split("\\").join("/");

const PASS = "#!/bin/sh\nexit 0\n";
const FIND = '#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = --report-path ] && printf \'[{"File": "note.md", "Secret": "REDACTED"}]\\n\' > "$2"; shift; done\nexit 1\n';
const CRASH = "#!/bin/sh\necho 'FTL unable to load gitleaks config' >&2\nexit 1\n";

const run = (command, args, options) =>
  new Promise((done) => {
    const child = spawn(command, args, options);
    const output = { stdout: "", stderr: "" };
    child.stdout.on("data", (data) => (output.stdout += data));
    child.stderr.on("data", (data) => (output.stderr += data));
    child.on("close", (status) => done({ status, ...output }));
  });

async function clone(t, gitleaks = PASS) {
  const root = mkdtempSync(join(tmpdir(), "hook-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const stub = join(root, "gitleaks");
  if (gitleaks !== null) writeFileSync(stub, gitleaks, { mode: 0o755 });
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(root, "gitconfig"), GIT_CONFIG_NOSYSTEM: "1", GITLEAKS_BIN: slash(stub) };
  writeFileSync(env.GIT_CONFIG_GLOBAL, "[user]\n\tname = t\n\temail = t@example.invalid\n");
  const repo = join(root, "repo");
  cpSync(CHECKS, join(repo, "checks"), { recursive: true, filter: (path) => !path.endsWith("README.md") });
  const gitIn = (cwd) => (...args) => run("git", args, { cwd, env });
  const git = gitIn(repo);
  const install = () => run(process.execPath, ["checks/install-hook.js"], { cwd: repo, env });
  await git("init", "-q");
  await git("add", "-A");
  await git("commit", "-q", "-m", "checks");
  const installed = await install();
  assert.equal(installed.status, 0, installed.stderr);
  return { root, repo, env, git, gitIn, install };
}

const commits = async (git) => (await git("rev-list", "--count", "HEAD")).stdout.trim();

async function stage(repo, git, text) {
  writeFileSync(join(repo, "note.md"), text);
  await git("add", "note.md");
}

const GITLEAKS = [
  ["is not installed", null, /pre-commit refused by gitleaks:\r?\ngitleaks cannot run: ".+" is not installed\. Fix: install gitleaks/],
  ["finds a secret", FIND, /pre-commit refused by gitleaks:\r?\ngitleaks found a secret in: note\.md\. Fix: take it out of the staged file/],
  ["fails without a report", CRASH, /FTL unable to load gitleaks config\r?\ngitleaks failed with exit 1 and wrote no report, so the staged files were not scanned\. Fix the error above/],
];

describe("the pre-commit hook", { concurrency: true }, () => {
  test("a staged em dash makes the hook refuse the commit, with the file, line and fix", async (t) => {
    const { repo, git } = await clone(t);
    await stage(repo, git, "fine\nbad \u2014 here\n");
    const commit = await git("commit", "-m", "add a note");
    assert.notEqual(commit.status, 0);
    assert.match(commit.stderr, /pre-commit refused by checks/);
    assert.match(commit.stderr, /note\.md:2:5: em dash\. Rewrite the sentence/);
    assert.equal(await commits(git), "1");
  });

  test("the checks judge the staged files, not the working tree", async (t) => {
    const { repo, git } = await clone(t);
    await stage(repo, git, "bad \u2014 staged\n");
    writeFileSync(join(repo, "note.md"), "fixed only in the working tree\n");
    assert.notEqual((await git("commit", "-m", "staged dash")).status, 0);
    await git("add", "note.md");
    writeFileSync(join(repo, "note.md"), "bad \u2014 unstaged\n");
    writeFileSync(join(repo, "untracked.md"), "bad \u2014 untracked\n");
    const commit = await git("commit", "-m", "clean staged note");
    assert.equal(commit.status, 0, commit.stderr);
    assert.equal(await commits(git), "2");
  });

  test("a file marked with git add -N stays out of the checks, as it stays out of the commit", async (t) => {
    const { repo, git } = await clone(t);
    writeFileSync(join(repo, "AGENTS.md"), "# rules\n");
    await git("add", "-N", "AGENTS.md");
    await stage(repo, git, "fine\n");
    const commit = await git("commit", "-m", "add a note");
    assert.equal(commit.status, 0, commit.stderr);
    assert.equal(await commits(git), "2");
  });

  for (const [state, stub, message] of GITLEAKS) {
    test(`a gitleaks that ${state} refuses the commit and says how to fix it`, async (t) => {
      const { repo, git } = await clone(t, stub);
      await stage(repo, git, "fine\n");
      const commit = await git("commit", "-m", "add a note");
      assert.notEqual(commit.status, 0);
      assert.match(commit.stderr, message);
      assert.equal(await commits(git), "1");
    });
  }

  test("npm run hooks reinstalls its own hook and keeps one it did not write", async (t) => {
    const { repo, install } = await clone(t);
    assert.equal((await install()).status, 0);
    const other = join(repo, ".git", "hooks", "pre-commit");
    writeFileSync(other, PASS);
    const refused = await install();
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /holds another pre-commit hook\. Move it out, or call it from checks\/pre-commit\.sh/);
    assert.equal(readFileSync(other, "utf8"), PASS);
  });

  test("a worktree's commit reaches the hook through a global hooks path that chains to the repo's hook", async (t) => {
    const { root, env, git, gitIn } = await clone(t);
    const global = join(root, "global-hooks");
    mkdirSync(global);
    writeFileSync(join(global, "pre-commit"), '#!/bin/sh\necho "global hook ran" >&2\nexec "$(git rev-parse --git-common-dir)/hooks/pre-commit" "$@"\n', { mode: 0o755 });
    appendFileSync(env.GIT_CONFIG_GLOBAL, `[core]\n\thooksPath = ${slash(global)}\n`);
    const side = join(root, "side");
    await git("worktree", "add", "-q", "-b", "side", side);
    const sideGit = gitIn(side);
    await stage(side, sideGit, "bad \u2014 here\n");
    const commit = await sideGit("commit", "-m", "add a note");
    assert.notEqual(commit.status, 0);
    assert.match(commit.stderr, /global hook ran[\s\S]*pre-commit refused by checks[\s\S]*note\.md:1:5: em dash/);
  });
});
