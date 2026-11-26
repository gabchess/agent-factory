import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as prBody from "../checks/pr-body.js";

const { check } = prBody;
const HEAD = "1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6";
const NPM = ["npm test", "npm run check"];
const PY = ["python -I -X utf8 -m unittest discover -s tests", "python -I -X utf8 -m unittest discover -s checks", "python -I -X utf8 checks/run.py"];
const file = (name) => fileURLToPath(new URL(`./fixtures/pr-body/${name}`, import.meta.url));
const read = (name) => readFileSync(file(name), "utf8").replace(/\r\n/g, "\n");
const body = (name) => read(`${name}.md`);
const RUN = fileURLToPath(new URL("../checks/run-pr-body.js", import.meta.url));

// The pr skill as its author wrote it, copied unchanged with its upstream commit in skill/UPSTREAM.md.
// Its template is the first "```markdown" block. Each "## " line opens a section, and each line holding a <placeholder> is a field, labelled when "**<label>:**" comes before it.
const SKILL = read("skill/SKILL.md");
const lines = SKILL.split("\n");
const TEMPLATE = `${lines.slice(lines.indexOf("```markdown") + 1, lines.indexOf("```", lines.indexOf("```markdown"))).join("\n")}\n`;
const SECTIONS = [];
for (const line of TEMPLATE.split("\n")) {
  const heading = /^## (.+)$/.exec(line);
  const field = /^\s*(?:- )?(?:\*\*(.+):\*\* )?(<.+>)$/.exec(line);
  if (heading) SECTIONS.push({ heading: heading[1], fields: [] });
  else if (field) SECTIONS.at(-1).fields.push(field[1] ? { label: field[1], placeholder: field[2] } : { placeholder: field[2] });
}
const REQUIRED = SECTIONS.flatMap(({ heading, fields }) => fields.filter((field) => !field.placeholder.startsWith("<optional:")).map((field) => ({ heading, ...field })));

const COMMIT = /mattpocock\/skills\/tree\/([0-9a-f]{40})\//.exec(read("skill/UPSTREAM.md"))[1];
const URL_PIN = `https://github.com/mattpocock/skills/blob/${COMMIT}/skills/engineering/pr/SKILL.md`;
const PIN = `the sections and labels above are the pr skill's template at mattpocock/skills ${COMMIT.slice(0, 7)} (${URL_PIN}). If your pr skill writes other ones, it is newer than this pin: write the body to this template, or move the pin as checks/README.md says.`;
const ORDER = 'the sections are out of order. Put them in the template\'s order: "## Summary", "## Evidence", "## Merge Danger".';
const missing = (heading) => `the body has no "## ${heading}" section. Add it as the pr skill's template writes it.`;
const noVisual = (heading, placeholder) => `"## ${heading}" holds no code block or image in place of "${placeholder}". Add one.`;
const noLabel = (heading, label, placeholder) => `"## ${heading}" lacks "**${label}:**". Add it with "${placeholder}" filled in.`;
const empty = (heading, label, placeholder) => `"**${label}:**" under "## ${heading}" holds nothing but "${placeholder}", a comment or markup. Write it after the label, before the next label or the end of its list item.`;
const noChoice = (heading, label) => `"**${label}:**" under "## ${heading}" does not say "one-way" or "two-way". Write one of them.`;
const noHead = (head) => `the body does not name the head ${head}. Run the checks at the head and quote their last lines with its SHA, as ADR 0006 asks.`;
const noCommand = (command) => `no code block quotes "${command}". Run it at the head and quote it with the last lines it printed.`;
const noOutput = (command) => `"${command}" has no output after it in its code block. Add the last lines it printed.`;
const unfilled = ({ heading, label, placeholder }) => (label ? empty(heading, label, placeholder) : noVisual(heading, placeholder));
const fill = (template, { label, placeholder }) =>
  template.replace(placeholder, !label ? "```text\nchecks/pr-body.js\n```" : placeholder.includes(" or ") ? placeholder.slice(1, -1).split(" or ")[1] : "the run printed 3 passing");

test("the check's template is the pr skill's own, and the check, the copy and AGENTS.md pin one commit of it", () => {
  assert.ok(REQUIRED.length >= 5, "the copied skill holds a template with its fields");
  const bytes = Buffer.from(SKILL);
  const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  assert.ok(read("skill/UPSTREAM.md").includes(`blob \`${blob}\``), "the copy is the blob UPSTREAM.md names");
  assert.deepEqual(prBody.TEMPLATE, SECTIONS);
  assert.equal(prBody.SKILL_URL, URL_PIN);
  assert.ok(readFileSync(fileURLToPath(new URL("../AGENTS.md", import.meta.url)), "utf8").includes(`(${URL_PIN})`));
});

test("the pr skill's untouched template fails once per field, and still fails with any one field filled", () => {
  assert.deepEqual(check(TEMPLATE), [...REQUIRED.map(unfilled), PIN]);
  for (const field of REQUIRED) {
    assert.deepEqual(check(fill(TEMPLATE, field)), [...REQUIRED.filter((other) => other !== field).map(unfilled), PIN], `${field.label ?? field.heading} filled alone`);
  }
  assert.deepEqual(check(REQUIRED.reduce(fill, TEMPLATE)), []);
});

test("the six bodies agents wrote with the pr skill on 2026-11-26 pass at their heads with their repos' check commands", () => {
  // real/ holds the public bodies as GitHub returned them. The other four PRs sit in private repos, so shape/ holds
  // synthetic bodies with the same Markdown: prose before the output, output on the command's own line, no rev-parse line.
  const bodies = [
    ["real/agent-factory-44", "2a831a590e94d3cbce30298b3efca08a738a81b8", NPM],
    ["real/agent-factory-45", "0c0bb659fef73c317bc155bd47eec36e6cbd00cd", NPM],
    ["shape/skills-77", "d9322383f33d488049682c5d3dd92fc5ffa4c512", ["npm ci", ...NPM]],
    ["shape/content-factory-15", "000c20e0e9b43b7567a0153e8a950e5a174aef6d", PY],
    ["shape/content-factory-16", "07cf09e3ab52717a05815c66a84b3bcda7755b08", PY],
    ["shape/content-factory-dust-1", "d5dd1204ce5a1edb37ec52fb7a553b5a35adf1a0", PY],
  ];
  for (const [name, head, commands] of bodies) assert.deepEqual(check(body(name), { head, commands }), [], name);
  const head = "c37d606b0be58fb34743443b191c8414261e0ac7";
  assert.deepEqual(check(body("real/agent-factory-42"), { head, commands: NPM }), [
    noHead(head),
    ...NPM.map(noCommand),
    ...["Summary", "Evidence", "Merge Danger"].map(missing),
    PIN,
  ]);
});

test("bodies that fill the template pass in either letter case, with CRLF, prose around them, comments and literal markers", () => {
  const pass = (text) => check(text, { head: HEAD, commands: NPM });
  assert.deepEqual(pass(body("pass/plain")), []);
  assert.deepEqual(pass(body("pass/upstream-case").replace(/\n/g, "\r\n")), []);
  assert.deepEqual(pass(body("pass/multiline-evidence")), []);
  assert.deepEqual(pass(body("pass/literal-markers")), []);
  assert.deepEqual(pass(body("pass/arrow")), []);
});

test("sections GitHub shows as code, literal text or a hidden comment do not count", () => {
  const fails = (name) => check(body(`fail/${name}`), { head: HEAD, commands: NPM });
  assert.deepEqual(fails("trailing-fence"), [missing("Evidence"), missing("Merge Danger"), PIN]);
  assert.deepEqual(fails("pre-wrapper"), [missing("Evidence"), missing("Merge Danger"), PIN]);
  assert.deepEqual(fails("hidden-sections"), [missing("Summary"), missing("Evidence"), missing("Merge Danger"), PIN]);
  assert.deepEqual(check(body("fail/quoted-sections")), [missing("Summary"), missing("Evidence"), missing("Merge Danger"), PIN]);
});

test("a label counts only as markup outside code, with content of its own under its own heading", () => {
  const fails = (name) => check(body(`fail/${name}`), { head: HEAD, commands: NPM });
  const [before, after] = SECTIONS.find(({ heading }) => heading === "Evidence").fields;
  assert.deepEqual(fails("code-labels"), [noLabel("Evidence", "Before", before.placeholder), noLabel("Evidence", "After", after.placeholder), PIN]);
  assert.deepEqual(fails("separate-note"), [empty("Evidence", "After", after.placeholder), PIN]);
  assert.deepEqual(check(body("fail/punctuation")), [empty("Evidence", "Before", before.placeholder), empty("Evidence", "After", after.placeholder), PIN]);
  assert.deepEqual(check(body("fail/second-pair")), [empty("Evidence", "After", after.placeholder), PIN]);
  assert.deepEqual(check(body("fail/code-placeholders")), [...REQUIRED.map(unfilled), PIN]);
  assert.deepEqual(check(body("fail/door-placeholder-html")), [noChoice("Merge Danger", "Door"), PIN]);
  assert.deepEqual(check(body("fail/door-placeholder-text")), [noChoice("Merge Danger", "Door"), PIN]);
  assert.deepEqual(check(body("fail/emphasis-placeholder")), [empty("Merge Danger", "Blast Radius", "<one-word description>"), PIN]);
  assert.deepEqual(fails("inline-comment"), [empty("Evidence", "Before", before.placeholder), PIN]);
  assert.deepEqual(fails("out-of-order"), [ORDER, PIN]);
  assert.deepEqual(fails("no-sections"), [missing("Summary"), missing("Evidence"), missing("Merge Danger"), PIN]);
  assert.deepEqual(fails("empty-sections"), [
    noVisual("Summary", "<diagram, diff-sketch, or tree>"),
    noLabel("Evidence", "Before", before.placeholder),
    noLabel("Evidence", "After", after.placeholder),
    noChoice("Merge Danger", "Door"),
    empty("Merge Danger", "Blast Radius", "<one-word description>"),
    PIN,
  ]);
});

test("with --head and --command, the body names the head and a code block quotes each command with its output", () => {
  const fails = (name) => check(body(`fail/${name}`), { head: HEAD, commands: NPM });
  assert.deepEqual(fails("no-sha"), [noHead(HEAD)]);
  assert.deepEqual(fails("other-sha"), [noHead(HEAD)]);
  assert.deepEqual(fails("commands"), [noOutput("npm test"), noCommand("npm run check")]);
  assert.deepEqual(fails("no-checks"), [noHead(HEAD), ...NPM.map(noCommand)]);
  assert.deepEqual(fails("hidden-head"), [noHead(HEAD)]);
  assert.deepEqual(fails("head-in-href"), [noHead(HEAD)]);
  assert.deepEqual(check(body("pass/head-in-link"), { head: HEAD, commands: NPM }), []);
  assert.deepEqual(fails("filtered-command"), [noCommand("npm test")]);
  assert.deepEqual(check(body("pass/tabbed-output"), { head: HEAD, commands: NPM }), []);
  assert.deepEqual(check(body("pass/br-breaks"), { head: HEAD, commands: NPM }), []);
  assert.deepEqual(check(body("fail/no-checks")), []);
  assert.deepEqual(check(body("fail/other-sha"), { commands: NPM }), []);
});

test("run-pr-body.js reads a file or stdin, prints each failure and exits 1, and refuses a short head", () => {
  const run = (args, input) => spawnSync(process.execPath, [RUN, ...args], { input, encoding: "utf8" });
  const named = ["--head", HEAD, "--command", "npm test", "--command", "npm run check"];
  assert.equal(run([...named, file("pass/plain.md")]).status, 0);
  assert.equal(run(named, body("pass/plain")).status, 0);
  const failed = run([...named, file("fail/out-of-order.md")]);
  assert.equal(failed.status, 1);
  assert.equal(failed.stderr, `PR body: ${ORDER}\nPR body: ${PIN}\n`);
  const short = run(["--head", "1f0e2d3", file("pass/plain.md")]);
  assert.equal(short.status, 2);
  assert.match(short.stderr, /Pass the full 40 character head SHA/);
});
