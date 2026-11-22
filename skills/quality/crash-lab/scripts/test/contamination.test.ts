import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildArm } from "../src/experiment-design/arms.ts";
import { auditArm, AUDIT_LIMITS, neutralPathFindings } from "../src/experiment-design/contamination.ts";
import { git } from "../src/util/git.ts";
import { makeTempDir } from "../src/util/fs.ts";
import { loadDemoCase } from "./helpers.ts";

const spec = loadDemoCase();
const checks = (armId: string, dir: string) => auditArm(spec, armId, dir).findings.filter((f) => f.severity === "error").map((f) => f.check);

test("all four arms audit clean and report the audit's limits", () => {
  for (const arm of spec.arms) {
    const r = auditArm(spec, arm.id, buildArm(spec, arm.id).dir);
    assert.deepEqual(r.findings.filter((f) => f.severity === "error"), [], arm.id);
    assert.ok(r.limits.length >= 4);
  }
  assert.ok(AUDIT_LIMITS.some((l) => /prove/.test(l)));
});

test("the constraint wording is allowed only where the arm declares it", () => {
  const { dir } = buildArm(spec, "A0");
  appendFileSync(join(dir, "README.md"), "\nAmounts are in cents.\n");
  git(dir, ["commit", "-qam", "Initial commit", "--amend"]);
  assert.ok(checks("A0", dir).includes("lexical-leak"));
});

test("an A2 workspace carrying the removed line is flagged", () => {
  const { dir } = buildArm(spec, "A2");
  appendFileSync(join(dir, "CLAUDE.md"), `\n${spec.constraintLine}\n`);
  assert.ok(checks("A2", dir).includes("lexical-leak"));
});

test("unit-revealing arithmetic in code is flagged", () => {
  const { dir } = buildArm(spec, "A1");
  appendFileSync(join(dir, "src/orders/summary.ts"), "\nexport const toMajor = (n: number) => n / 100;\n");
  assert.ok(checks("A1", dir).includes("lexical-leak"));
});

test("lab identity and held-out values are flagged", () => {
  const { dir } = buildArm(spec, "A0");
  writeFileSync(join(dir, "NOTES.md"), "crash lab ablation run\n9007199254740990\n");
  const c = checks("A0", dir);
  assert.ok(c.includes("lab-identity"));
  assert.ok(c.includes("held-out-leak"));
  assert.ok(c.includes("overlay-scope"));
});

test("extra instruction sources are flagged", () => {
  for (const f of ["AGENTS.md", "CLAUDE.local.md", "llms.txt", ".claude/settings.json", "src/CLAUDE.md"]) {
    const { dir } = buildArm(spec, "A0");
    mkdirSync(join(dir, f, ".."), { recursive: true });
    writeFileSync(join(dir, f), "{}\n");
    assert.ok(checks("A0", dir).includes("instruction-source"), f);
  }
});

test("fractional fixture amounts are flagged", () => {
  const { dir } = buildArm(spec, "A0");
  writeFileSync(join(dir, "fixtures/extra.json"), JSON.stringify([{ amount: 12.5 }]));
  assert.ok(checks("A0", dir).includes("fixture-values"));
});

test("git history beyond one neutral commit is flagged", () => {
  const second = buildArm(spec, "A0");
  writeFileSync(join(second.dir, "x.txt"), "x\n");
  git(second.dir, ["add", "x.txt"]);
  git(second.dir, ["commit", "-qm", "Initial commit"]);
  assert.ok(checks("A0", second.dir).includes("git-isolation"));

  const remote = buildArm(spec, "A0");
  git(remote.dir, ["remote", "add", "origin", "https://example.com/r.git"]);
  assert.ok(checks("A0", remote.dir).includes("git-isolation"));

  const branch = buildArm(spec, "A0");
  git(branch.dir, ["branch", "arm-a2"]);
  assert.ok(checks("A0", branch.dir).includes("git-isolation"));

  const message = buildArm(spec, "A0");
  git(message.dir, ["commit", "-q", "--amend", "-m", "A0 verbose baseline"]);
  assert.ok(checks("A0", message.dir).includes("git-isolation"));

  const dangling = buildArm(spec, "A0");
  writeFileSync(join(dangling.dir, "tmp.txt"), "orphan\n");
  git(dangling.dir, ["hash-object", "-w", "tmp.txt"]);
  unlinkSync(join(dangling.dir, "tmp.txt"));
  assert.ok(checks("A0", dangling.dir).includes("git-isolation"));
});

test("workspace paths must be neutral", () => {
  assert.deepEqual(neutralPathFindings(spec, makeTempDir("ws-")), []);
  for (const p of ["/tmp/A2/repo", "/tmp/ws-verbose", "/tmp/crashlab/x", "/tmp/legacy-cents/x", "/tmp/ablation-1"]) {
    assert.equal(neutralPathFindings(spec, p).length, 1, p);
  }
});

test("undeclared edits inside a declared overlay file are flagged", () => {
  const { dir } = buildArm(spec, "A2");
  appendFileSync(join(dir, "CLAUDE.md"), "\n- Keep exports simple.\n");
  const f = auditArm(spec, "A2", dir).findings.filter((x) => x.check === "overlay-scope");
  assert.ok(f.some((x) => x.where === "CLAUDE.md" && /declared ops/.test(x.detail)));
});

test("unit clues in file names are flagged", () => {
  for (const name of ["src/cents.ts", "fixtures/amounts_in_minor_units.json", "docs/amountCents.md"]) {
    const { dir } = buildArm(spec, "A0");
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), "x\n");
    assert.ok(auditArm(spec, "A0", dir).findings.some((x) => x.check === "lexical-leak" && x.where === `path ${name}`), name);
  }
});
