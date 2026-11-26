import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKS = fileURLToPath(new URL("../checks/", import.meta.url));
const slash = (path) => path.split("\\").join("/");

const PASS = '#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = --report-path ] && printf "[]\\n" > "$2"; shift; done\nexit 0\n';
const FIND = '#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = --report-path ] && printf \'[{"File": "note.md", "Secret": "REDACTED"}]\\n\' > "$2"; shift; done\nexit 1\n';
const CRASH = "#!/bin/sh\necho 'FTL unable to load gitleaks config' >&2\nexit 1\n";

const run = (command, args, options) =>
  new Promise((done, fail) => {
    const child = spawn(command, args, options);
    const output = { stdout: "", stderr: "" };
    child.on("error", (error) => fail(new Error(`${command} could not start: ${error.message}`)));
    child.stdout.on("data", (data) => (output.stdout += data));
    child.stderr.on("data", (data) => (output.stderr += data));
    child.on("close", (status) => done({ status, ...output }));
  });

async function clone(t, gitleaks = PASS, { name = "gitleaks", mode = 0o755 } = {}) {
  const root = mkdtempSync(join(tmpdir(), "hook-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const stub = join(root, name);
  if (gitleaks !== null) writeFileSync(stub, gitleaks, { mode });
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

const NOT_SCANNED = /pre-commit WARNING: NOT SCANNED FOR SECRETS\. checks\/pre-commit\.sh did not scan the staged files with gitleaks\.\r?\nWhy: [^\r\n]+\r?\nFix: [^\r\n]+/;
const REFUSED = /refused/;
const SCAN_AFTER = /Then: once git makes this commit, scan it with: ([^\r\n]+)/;
const NO_COMMIT = /Then: no commit was made, since the checks below refuse it\./;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

const pathKey = (env) => Object.keys(env).find((name) => name.toUpperCase() === "PATH");
const find = (name, path) => {
  for (const dir of path.split(delimiter)) {
    for (const ext of process.platform === "win32" ? [".exe", ""] : [""]) {
      const file = join(dir, name + ext);
      if (existsSync(file) && statSync(file).isFile()) return file;
    }
  }
};
const REAL_GITLEAKS = find("gitleaks", process.env[pathKey(process.env)]);

// A PATH that holds git, sh and the tools the hook calls, and no node, wherever node lives.
const HOOK_TOOLS = ["git", "sh", "cat", "grep", "head", "mktemp", "rm", "sed", "sort", "tr"];
const withoutNode = (repo, env) => {
  const key = pathKey(env);
  const bin = join(dirname(repo), "bin");
  mkdirSync(bin);
  const dirs = new Set([bin]);
  for (const tool of HOOK_TOOLS) {
    const real = find(tool, env[key]);
    assert.ok(real, `${tool} is not on PATH, so the test cannot build a PATH for the hook`);
    // Windows looks for an .exe's DLLs beside the file it starts from, so a link to git.exe cannot start: use its own folder.
    if (process.platform === "win32") dirs.add(dirname(real));
    else symlinkSync(real, join(bin, tool));
  }
  for (const dir of dirs) assert.ok(!existsSync(join(dir, "node")) && !existsSync(join(dir, "node.exe")), `node shares ${dir} with git here, so this test cannot hide it`);
  return { ...env, [key]: [...dirs].join(delimiter) };
};

const SCRIPT = "\x1b[31mPWNED\x07 \x00\x01 run me\n";
const GITLEAKS_BROKEN = [
  { state: "is not installed", stub: null, refuse: true, why: /Why: ".+" is not installed\.[^\r\n]*\r?\nFix: install gitleaks/ },
  { state: "crashes without a report", stub: CRASH, refuse: true, why: /Why: gitleaks exited 1 without a findings report\.[^\r\n]*\r?\nFix: [^\r\n]*\r?\n[\s\S]*FTL unable to load gitleaks config/ },
  { state: "exits 0 without a report", stub: "#!/bin/sh\nexit 0\n", why: /Why: gitleaks exited 0 without a findings report\./ },
  { state: "exists but is not executable", stub: SCRIPT, mode: 0o644, why: /Why: ".+" exists but will not execute( \(exit \d+\))?\./ },
  { state: "is a text file named gitleaks.exe", stub: SCRIPT, name: "gitleaks.exe", why: /Why: (".+" exists but will not execute|gitleaks exited \d+ without a findings report)/ },
  { state: "prints raw bytes and crashes", stub: "#!/bin/sh\nprintf '\\033[2J\\007\\001MZ garbage\\n' >&2\nexit 1\n", why: /Why: gitleaks exited 1 without a findings report\./ },
  { state: "is a broken MZ binary", stub: `MZ\x90\x00\x03\x00${SCRIPT}`, name: "gitleaks.exe", why: /Why: (".+" exists but will not execute|gitleaks exited \d+ without a findings report)/ },
];

// Crashes in the hook's pre-commit scan, and runs the real gitleaks for any other command, such as the scan the warning prints.
const DELEGATE = (real) => `#!/bin/sh\nfor a; do [ "$a" = --pre-commit ] && { echo 'FTL unable to load gitleaks config' >&2; exit 1; }; done\nexec "${slash(real)}" "$@"\n`;
const token = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return `ghp_${[...randomBytes(36)].map((byte) => chars[byte % chars.length]).join("")}`;
};

async function scanAfter(repo, env, stderr) {
  const command = SCAN_AFTER.exec(stderr)?.[1];
  assert.ok(command, `no scan command in:\n${stderr}`);
  return run("sh", ["-c", command], { cwd: repo, env });
}

const CHECKS_CANNOT_RUN = [
  ["node is not on PATH", withoutNode, /pre-commit refused by checks:\r?\nchecks\/run\.js cannot run: node is not installed\. Fix: install Node 22 or later/],
  ["checks/run.js is missing", (repo) => rmSync(join(repo, "checks", "run.js")), /pre-commit refused by checks:\r?\nchecks\/run\.js cannot run: it is missing from this checkout\. Fix: /],
  ["checks/pre-commit.sh is missing", (repo) => rmSync(join(repo, "checks", "pre-commit.sh")), /pre-commit refused: .+checks\/pre-commit\.sh is missing, so no check ran\. Fix: /],
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
    const intent = await git("add", "-N", "AGENTS.md");
    assert.equal(intent.status, 0, intent.stderr);
    await stage(repo, git, "fine\n");
    const commit = await git("commit", "-m", "add a note");
    assert.equal(commit.status, 0, commit.stderr);
    assert.equal(await commits(git), "2");
  });

  for (const { state, stub, why, name, mode, refuse } of GITLEAKS_BROKEN) {
    test(`a gitleaks that ${state} lets a clean commit through with the not-scanned warning and the scan to run after, and no refusal`, async (t) => {
      const { repo, git } = await clone(t, stub, { name, mode });
      await stage(repo, git, "fine\n");
      const commit = await git("commit", "-m", "add a note");
      assert.equal(commit.status, 0, commit.stderr);
      assert.match(commit.stderr, NOT_SCANNED);
      assert.match(commit.stderr, why);
      assert.match(commit.stderr, SCAN_AFTER);
      assert.doesNotMatch(commit.stderr, REFUSED);
      assert.doesNotMatch(commit.stderr, CONTROL);
      if (stub !== null) assert.doesNotMatch(commit.stderr, /is not installed/);
      assert.equal(await commits(git), "2");
    });

    // The refusal does not depend on how gitleaks broke, so two kinds cover it and keep npm test short.
    if (!refuse) continue;
    test(`a gitleaks that ${state} still lets a failing check refuse the commit, and says no commit was made`, async (t) => {
      const { repo, git } = await clone(t, stub, { name, mode });
      await stage(repo, git, "bad \u2014 here\n");
      const commit = await git("commit", "-m", "add a note");
      assert.notEqual(commit.status, 0);
      assert.match(commit.stderr, NOT_SCANNED);
      assert.match(commit.stderr, NO_COMMIT);
      assert.doesNotMatch(commit.stderr, SCAN_AFTER);
      assert.match(commit.stderr, /pre-commit refused by checks:[\s\S]*note\.md:1:5: em dash/);
      assert.equal(await commits(git), "1");
    });
  }

  const realGitleaks = { skip: REAL_GITLEAKS ? false : "gitleaks is not on PATH" };

  test("the scan a not-scanned warning prints finds a secret in a normal commit", realGitleaks, async (t) => {
    const { repo, env, git } = await clone(t, DELEGATE(REAL_GITLEAKS));
    writeFileSync(join(repo, "leak.txt"), `token = ${token()}\n`);
    await git("add", "leak.txt");
    const commit = await git("commit", "-m", "add a leak");
    assert.equal(commit.status, 0, commit.stderr);
    const scan = await scanAfter(repo, env, commit.stderr);
    assert.equal(scan.status, 1, scan.stdout + scan.stderr);
    assert.match(scan.stdout + scan.stderr, /leaks found: [1-9]/);
  });

  test("the scan a not-scanned warning prints finds a secret in a conflicted merge's resolution", realGitleaks, async (t) => {
    const { repo, env, git } = await clone(t, DELEGATE(REAL_GITLEAKS));
    writeFileSync(join(repo, "conf.txt"), "base\n");
    await git("add", "conf.txt");
    await git("commit", "-q", "-m", "base");
    await git("checkout", "-q", "-b", "side");
    writeFileSync(join(repo, "conf.txt"), "side\n");
    await git("commit", "-q", "-am", "side");
    await git("checkout", "-q", "-");
    writeFileSync(join(repo, "conf.txt"), "main\n");
    await git("commit", "-q", "-am", "main");
    assert.notEqual((await git("merge", "side")).status, 0, "the merge should conflict");
    writeFileSync(join(repo, "conf.txt"), `token = ${token()}\n`);
    await git("add", "conf.txt");
    const commit = await git("commit", "--no-edit");
    assert.equal(commit.status, 0, commit.stderr);
    assert.equal((await git("rev-list", "--parents", "-1", "HEAD")).stdout.trim().split(" ").length, 3, "HEAD should be a merge");
    const scan = await scanAfter(repo, env, commit.stderr);
    assert.equal(scan.status, 1, scan.stdout + scan.stderr);
    assert.match(scan.stdout + scan.stderr, /leaks found: [1-9]/);
  });

  test("a gitleaks that finds a secret refuses the commit with the file and fix, and no not-scanned warning", async (t) => {
    const { repo, git } = await clone(t, FIND);
    await stage(repo, git, "fine\n");
    const commit = await git("commit", "-m", "add a note");
    assert.notEqual(commit.status, 0);
    assert.match(commit.stderr, /pre-commit refused by gitleaks:\r?\ngitleaks found a secret in: note\.md\. Fix: take it out of the staged file/);
    assert.doesNotMatch(commit.stderr, /NOT SCANNED/);
    assert.equal(await commits(git), "1");
  });

  for (const [state, breakIt, message] of CHECKS_CANNOT_RUN) {
    test(`when ${state}, the hook refuses the commit and says how to fix it`, async (t) => {
      const { repo, env, git } = await clone(t);
      await stage(repo, git, "fine\n");
      const commitEnv = breakIt(repo, env) ?? env;
      const commit = await run("git", ["commit", "-m", "add a note"], { cwd: repo, env: commitEnv });
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
