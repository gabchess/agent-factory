import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { check } from "../checks/pr-body.js";

const HEAD = "1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6";
const COMMANDS = ["npm test", "npm run check"];
const path = (name) => fileURLToPath(new URL(`./fixtures/pr-body/${name}.md`, import.meta.url));
const body = (name) => readFileSync(path(name), "utf8").replace(/\r\n/g, "\n");
const RUN = fileURLToPath(new URL("../checks/run-pr-body.js", import.meta.url));

const OPEN = 'the body does not open with the checks\' output. Start it with one fenced code block, before "## Summary", that holds "$ git rev-parse HEAD" with the SHA it printed, then each check command as "$ <command>" with the last lines it printed.';
const NO_HEAD = 'the checks\' output does not say which commit it ran on. Add "$ git rev-parse HEAD" and the SHA it printed to the opening code block.';
const NO_COMMANDS = 'the checks\' output holds no check command. Write each one as "$ <command>", with the last lines it printed under it.';
const ORDER = 'the sections are out of order. Put them in the pr skill\'s order: "## Summary", "## Evidence", "## Merge danger".';
const STALE = `the checks' output ran on aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, not the head ${HEAD}. Run the checks again at the head and replace the opening code block.`;
const NO_DIAGRAM = '"## Summary" holds no diagram, diff sketch or tree. Add one in a fenced code block.';
const NO_BEFORE = '"## Evidence" lacks "**Before:**" with something after it. Show the failing run or the output before the change.';
const NO_AFTER = '"## Evidence" lacks "**After:**" with something after it. Show the passing run or the output after the change.';
const missing = (name, what) => `the body has no "## ${name}" section. Add it ${what}, as the pr skill's template shows.`;
const NO_SECTIONS = [
  missing("Summary", "with a diagram, diff sketch or tree in a fenced code block"),
  missing("Evidence", "with **Before:** and **After:**"),
  missing("Merge danger", "with **Door:** and **Blast radius:**"),
];

test("bodies with the pr skill's sections under the checks' output at the head pass, in either letter case, with CRLF and with evidence on later lines", () => {
  assert.deepEqual(check(body("pass/plain"), { head: HEAD, commands: COMMANDS }), []);
  assert.deepEqual(check(body("pass/upstream-case").replace(/\n/g, "\r\n"), { head: HEAD, commands: COMMANDS }), []);
  assert.deepEqual(check(body("pass/multiline-evidence"), { head: HEAD, commands: COMMANDS }), []);
});

test("a comment opener in inline code and output made of dashes are text GitHub shows, so they pass", () => {
  assert.deepEqual(check(body("pass/literal-markers"), { head: HEAD, commands: COMMANDS }), []);
});

test("each body that lacks what the pr skill or the checks' output needs fails with the fix", () => {
  const fails = (name) => check(body(`fail/${name}`), { head: HEAD, commands: COMMANDS });
  assert.deepEqual(fails("no-checks"), [OPEN]);
  assert.deepEqual(fails("text-before-checks"), [OPEN]);
  assert.deepEqual(fails("no-sha"), [NO_HEAD]);
  assert.deepEqual(fails("other-sha"), [STALE]);
  assert.deepEqual(fails("stale-head"), [STALE]);
  assert.deepEqual(fails("commands"), [
    '"$ npm test" has no output under it. Add the last lines it printed.',
    'the checks\' output lacks "$ npm run check". Run it at the head and add the command and the last lines it printed to the opening code block.',
  ]);
  assert.deepEqual(fails("no-sections"), NO_SECTIONS);
  assert.deepEqual(fails("hidden-sections"), NO_SECTIONS);
  assert.deepEqual(fails("inline-comment"), [10, 18].map((line) => `line ${line} has an HTML comment inside it, which GitHub hides. Put the comment on lines of its own, or delete it.`));
  assert.deepEqual(fails("out-of-order"), [ORDER]);
  assert.deepEqual(fails("empty-template"), [NO_DIAGRAM, NO_BEFORE, NO_AFTER]);
  assert.deepEqual(fails("empty-sections"), [
    NO_DIAGRAM,
    NO_BEFORE,
    NO_AFTER,
    '"## Merge danger" lacks "**Door:** one-way" or "**Door:** two-way". Say whether a revert can walk the merge back.',
    '"## Merge danger" lacks "**Blast radius:**" with a word after it. Name what the merge can affect.',
  ]);
});

test("without a head, the SHA the output names is taken as given, and without named commands one check command with output is needed", () => {
  assert.deepEqual(check(body("fail/other-sha"), { commands: COMMANDS }), []);
  const onlyHead = body("pass/plain").replace(/\$ npm test[^`]*/, "");
  assert.deepEqual(check(onlyHead, { head: HEAD }), [NO_COMMANDS]);
});

test("run-pr-body.js reads a file or stdin, prints each failure and exits 1, and refuses a short head", () => {
  const run = (args, input) => spawnSync(process.execPath, [RUN, ...args], { input, encoding: "utf8" });
  const named = ["--head", HEAD, "--command", "npm test", "--command", "npm run check"];
  assert.equal(run([...named, path("pass/plain")]).status, 0);
  assert.equal(run(named, body("pass/plain")).status, 0);
  const failed = run([...named, path("fail/out-of-order")]);
  assert.equal(failed.status, 1);
  assert.equal(failed.stderr, `PR body: ${ORDER}\n`);
  const short = run(["--head", "1f0e2d3", path("pass/plain")]);
  assert.equal(short.status, 2);
  assert.match(short.stderr, /Pass the full 40 character head SHA/);
});
