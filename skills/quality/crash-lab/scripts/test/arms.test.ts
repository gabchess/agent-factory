import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildArm } from "../src/experiment-design/arms.ts";
import { git } from "../src/util/git.ts";
import { runProcess, sandboxEnv } from "../src/util/proc.ts";
import { makeTempDir } from "../src/util/fs.ts";
import { loadDemoCase } from "./helpers.ts";

const spec = loadDemoCase();
const constraint = "Partner order `amount` values are integers in the currency's minor unit";

test("arms differ by exactly the intended change", () => {
  const [a0, a1, a2, a3] = ["A0", "A1", "A2", "A3"].map((id) => buildArm(spec, id));
  const md = (a: { dir: string }) => readFileSync(join(a.dir, "CLAUDE.md"), "utf8");
  assert.ok(md(a0).includes(constraint));
  assert.ok(md(a1).includes(constraint));
  assert.ok(md(a1).length < md(a0).length / 2);
  assert.ok(!md(a2).includes(constraint));
  assert.equal(md(a2).split("\n").length, md(a0).split("\n").length - 1);
  assert.equal(md(a3), md(a2));
  const decoder = (a: { dir: string }) => readFileSync(join(a.dir, "src/legacy/decoder.ts"), "utf8");
  assert.equal(decoder(a0), decoder(a2));
  assert.match(decoder(a3), /amountMinorUnits: number/);
  assert.match(decoder(a3), /numeric\(r, "amount"/, "the wire field stays `amount`");
});

test("each arm is a fresh single-commit repo with identical neutral metadata", () => {
  const a = buildArm(spec, "A0");
  const b = buildArm(spec, "A2");
  assert.equal(git(a.dir, ["rev-list", "--all", "--count"]).trim(), "1");
  assert.notEqual(a.commit, b.commit);
  assert.equal(git(a.dir, ["log", "--format=%an <%ae> %ad %s"]), git(b.dir, ["log", "--format=%an <%ae> %ad %s"]));
  assert.equal(buildArm(spec, "A0").commit, a.commit, "building is deterministic");
});

test("base tests pass in every arm", () => {
  for (const arm of spec.arms) {
    const { dir } = buildArm(spec, arm.id);
    const r = runProcess("node", ["--test", "test/**/*.test.ts"], { cwd: dir, env: sandboxEnv(makeTempDir("home-")) });
    assert.equal(r.code, 0, `${arm.id}: ${r.stdout}${r.stderr}`);
  }
});
