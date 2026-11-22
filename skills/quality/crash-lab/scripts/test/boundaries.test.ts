import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transcriptProblems } from "../src/evidence-reporting/evidence.ts";
import { parseReporterCounts } from "../src/artifact-verification/node-test-report.ts";
import { expectedInFirstRequest } from "../src/session-execution/loading-probe.ts";
import { DEMO_RULESET } from "../src/instruction-context/claude-code-rules.ts";
import { runProcess } from "../src/util/proc.ts";
import { makeTempDir } from "../src/util/fs.ts";
import { initSingleCommitRepo } from "../src/util/git.ts";
import { inventoryClaudeCode, parseImports } from "../src/instruction-context/inventory.ts";

const ROOT = join(import.meta.dirname, "..");

test("a transcript with a line that is not JSON is reported, not silently skipped", () => {
  const path = join(makeTempDir("transcript-"), "t.jsonl");
  const init = JSON.stringify({ type: "system", subtype: "init", claude_code_version: "2.1.329" });
  writeFileSync(path, `${init}\n{"type":"assistant"\n${JSON.stringify({ type: "result" })}\n`);
  assert.deepEqual(transcriptProblems(path), [`transcript ${path} has 1 line(s) that are not JSON`]);
});

test("reporter output with non-numeric counts is an error, not a count", () => {
  const counts = { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  const summary = { tests: 1, passed: 1, failed: 0, cancelled: 0, skipped: 0, todo: 0 };
  assert.deepEqual(parseReporterCounts(JSON.stringify({ leaf: counts, summary })), { counts });
  assert.deepEqual(parseReporterCounts(JSON.stringify({ leaf: { ...counts, fail: "0" }, summary })), { error: "reporter output has counts that are not non-negative integers" });
  assert.deepEqual(parseReporterCounts(JSON.stringify({ leaf: { ...counts, pass: counts.pass + 1, fail: -1 }, summary: { ...summary, passed: summary.passed + 1, failed: -1 } })), { error: "reporter output has counts that are not non-negative integers" });
  assert.deepEqual(parseReporterCounts("null"), { error: "reporter output missing or corrupt" });
});

test("the loading probe expects exactly what the ruleset says loads, matching the committed receipt", () => {
  const receipt = JSON.parse(readFileSync(join(ROOT, "docs", "sandbox-probe", "loading-receipt.json"), "utf8"));
  assert.deepEqual(expectedInFirstRequest(DEMO_RULESET), receipt.loaded);
});

test("a command that cannot start says why in stderr", () => {
  const r = runProcess("crashlab-no-such-binary", []);
  assert.equal(r.code, null);
  assert.match(r.stderr, /crashlab-no-such-binary could not run: .*ENOENT/);
});

test("a session that did not complete needs no result event, and a null event is not an object", () => {
  const path = join(makeTempDir(), "t.jsonl");
  writeFileSync(path, `${JSON.stringify({ type: "system", subtype: "init", claude_code_version: "2.1.329" })}\nnull\n`);
  assert.deepEqual(transcriptProblems(path, { requireResult: false }), [`transcript ${path} has 1 line(s) that are not JSON`]);
  assert.ok(transcriptProblems(path).includes(`transcript ${path} has no result event`));
});

test("imports without an extension are found outside code spans", () => {
  assert.deepEqual(parseImports("See @README and @docs/guide.md.\nNot `@README` or a@b.com"), ["README", "docs/guide.md"]);
});

test("imports are followed through imported files and keep their parent's condition", () => {
  const repo = makeTempDir();
  mkdirSync(join(repo, "nested"));
  writeFileSync(join(repo, "CLAUDE.md"), "@a.md\n");
  writeFileSync(join(repo, "a.md"), "@b.md\n");
  writeFileSync(join(repo, "b.md"), "@a.md\n");
  writeFileSync(join(repo, "nested", "CLAUDE.md"), "@guide.md\n");
  writeFileSync(join(repo, "nested", "guide.md"), "rules\n");
  const imports = inventoryClaudeCode(repo).sources.filter((s) => s.kind === "import");
  assert.deepEqual(imports.map((s) => [s.path, s.shouldApply]), [["a.md", "yes"], ["nested/guide.md", "on-demand"], ["b.md", "yes"]]);
});

test("git ignores an inherited repository location", () => {
  const outer = makeTempDir();
  runProcess("git", ["init", "-q", outer]);
  const dir = makeTempDir();
  writeFileSync(join(dir, "f.txt"), "x\n");
  const before = { dir: process.env.GIT_DIR, tree: process.env.GIT_WORK_TREE };
  process.env.GIT_DIR = join(outer, ".git");
  process.env.GIT_WORK_TREE = outer;
  try {
    initSingleCommitRepo(dir);
  } finally {
    if (before.dir === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = before.dir;
    if (before.tree === undefined) delete process.env.GIT_WORK_TREE; else process.env.GIT_WORK_TREE = before.tree;
  }
  assert.ok(existsSync(join(dir, ".git")));
  assert.notEqual(runProcess("git", ["-C", outer, "rev-parse", "HEAD"]).code, 0);
});
