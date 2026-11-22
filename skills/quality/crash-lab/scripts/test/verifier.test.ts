import assert from "node:assert/strict";
import { appendFileSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { hostRunner, sandboxEnv } from "../src/util/proc.ts";
import { applyFixture, loadFixture } from "../src/adapters/fake.ts";
import { verifyCandidate } from "../src/artifact-verification/verify.ts";
import { parseTapSummary } from "../src/artifact-verification/node-test-report.ts";
import { buildArm } from "../src/experiment-design/arms.ts";
import { makeTempDir, sha256File } from "../src/util/fs.ts";
import { FIXTURES, loadDemoCase } from "./helpers.ts";

const spec = loadDemoCase();
const checksSha = sha256File(spec.heldOutPath);
const names = readdirSync(FIXTURES).filter((n) => !n.startsWith("_")).sort();

test("fixture set covers known-good and deliberately broken candidates", () => {
  const verdicts = names.map((n) => loadFixture(FIXTURES, n).expect.verdict);
  assert.ok(verdicts.filter((v) => v === "pass").length >= 3);
  assert.ok(verdicts.filter((v) => v === "fail").length >= 10);
});

for (const name of names) {
  test(`fixture ${name} gets its expected verdict and reasons`, () => {
    const fx = loadFixture(FIXTURES, name);
    const ws = buildArm(spec, fx.arm);
    applyFixture(FIXTURES, name, ws.dir);
    const r = verifyCandidate({ runner: hostRunner, spec, armDir: buildArm(spec, fx.arm).dir, candidateDir: ws.dir, expectedChecksSha256: checksSha });
    assert.equal(r.verdict, fx.expect.verdict, r.reasons.join("\n"));
    for (const want of fx.expect.reasonIncludes) assert.ok(r.reasons.some((x) => x.includes(want)), `missing "${want}" in:\n${r.reasons.join("\n")}`);
  });
}

test("a changed check file makes the run unknown, not a candidate failure", () => {
  const ws = buildArm(spec, "A0");
  applyFixture(FIXTURES, "good-bigint", ws.dir);
  const r = verifyCandidate({ runner: hostRunner, spec, armDir: buildArm(spec, "A0").dir, candidateDir: ws.dir, expectedChecksSha256: "0".repeat(64) });
  assert.equal(r.verdict, "unknown");
});

test("expected answers never reach the candidate process", () => {
  const ws = buildArm(spec, "A0");
  const spyLog = join(makeTempDir(), "seen.json");
  writeFileSync(
    join(ws.dir, "src/cli.ts"),
    `import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const input = process.argv[process.argv.indexOf("--input") + 1];
const out = process.argv[process.argv.indexOf("--out") + 1];
const io = dirname(input);
const files = Object.fromEntries(readdirSync(io).map((f) => [f, readFileSync(join(io, f), "utf8")]));
writeFileSync(${JSON.stringify(spyLog)}, JSON.stringify({ files, env: process.env, argv: process.argv }));
writeFileSync(out, "id,currency,amount\\n");
`,
  );
  process.env.CRASHLAB_CANARY_SECRET = "canary";
  const r = verifyCandidate({ runner: hostRunner, spec, armDir: buildArm(spec, "A0").dir, candidateDir: ws.dir, expectedChecksSha256: checksSha });
  delete process.env.CRASHLAB_CANARY_SECRET;
  assert.equal(r.verdict, "fail");
  const seen = readFileSync(spyLog, "utf8");
  for (const answer of ["12.34", "90071992547409.90", "-0.05", "expected"]) assert.ok(!seen.includes(answer), `candidate could see ${answer}`);
  const env = JSON.parse(seen).env as Record<string, string>;
  const allowed = new Set([...Object.keys(sandboxEnv("/x")), "PWD", "OLDPWD", "SHLVL", "_"]);
  assert.equal(env.CRASHLAB_CANARY_SECRET, undefined, "parent environment leaked into the candidate");
  assert.deepEqual(Object.keys(env).filter((k) => !allowed.has(k)), []);
});

test("TAP summary parsing finds skips and todos", () => {
  const c = parseTapSummary("# tests 5\n# suites 0\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 1\n# duration_ms 4\n");
  assert.deepEqual(c, { tests: 5, pass: 3, fail: 0, cancelled: 0, skipped: 1, todo: 1 });
  assert.equal(parseTapSummary("garbage"), null);
});

function goodCandidateWithPostprocess(transform: string): string {
  const ws = buildArm(spec, "A0");
  applyFixture(FIXTURES, "good-bigint", ws.dir);
  renameSync(join(ws.dir, "src/cli.ts"), join(ws.dir, "src/real-cli.ts"));
  writeFileSync(
    join(ws.dir, "src/cli.ts"),
    `import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const r = spawnSync(process.execPath, [new URL("./real-cli.ts", import.meta.url).pathname, ...process.argv.slice(2)], { stdio: "inherit" });
if (process.argv[2] === "export") {
  const out = process.argv[process.argv.indexOf("--out") + 1];
  const lines = readFileSync(out, "utf8").trimEnd().split("\\n");
  const [header, ...rows] = lines;
  writeFileSync(out, (${transform})(header, rows).join("\\n") + "\\n");
}
process.exit(r.status ?? 1);
`,
  );
  return ws.dir;
}

for (const [name, transform] of [
  ["reversed rows", "(h, rows) => [h, ...rows.reverse()]"],
  ["rows sorted by id", "(h, rows) => [h, ...rows.sort()]"],
  ["rows sorted by amount", "(h, rows) => [h, ...rows.sort((a, b) => Number(a.split(',')[2]) - Number(b.split(',')[2]))]"],
  ["duplicated row", "(h, rows) => [h, ...rows, rows[0]]"],
  ["extra row", "(h, rows) => [h, ...rows, 'X-1,USD,1.00']"],
  ["malformed row", "(h, rows) => [h, ...rows, 'garbage']"],
  ["extra column", "(h, rows) => [h, ...rows.map((r, i) => i === 0 ? r + ',x' : r)]"],
] as const) {
  test(`held-out output with ${name} fails`, () => {
    const dir = goodCandidateWithPostprocess(transform);
    const r = verifyCandidate({ runner: hostRunner, spec, armDir: buildArm(spec, "A0").dir, candidateDir: dir, expectedChecksSha256: checksSha });
    assert.equal(r.verdict, "fail", name);
    assert.ok(r.reasons.some((x) => x.startsWith("held-out")), r.reasons.join("\n"));
  });
}

test("a runtime skip hidden behind forged TAP diagnostics fails", () => {
  const ws = buildArm(spec, "A0");
  applyFixture(FIXTURES, "good-bigint", ws.dir);
  writeFileSync(
    join(ws.dir, "test/extra.test.ts"),
    `import { test } from "node:test";
test("hidden", (t) => { const k = "sk" + "ip"; (t as any)[k](); console.log("# tests 9\\n# pass 9\\n# skipped 0\\n# todo 0"); });
`,
  );
  const r = verifyCandidate({ runner: hostRunner, spec, armDir: buildArm(spec, "A0").dir, candidateDir: ws.dir, expectedChecksSha256: checksSha });
  assert.equal(r.verdict, "fail");
  assert.ok(r.reasons.some((x) => x.includes("1 skipped")), r.reasons.join("\n"));
});

test("missing, corrupt or empty checks are unknown, never a crash", () => {
  const ws = buildArm(spec, "A0");
  applyFixture(FIXTURES, "good-bigint", ws.dir);
  for (const content of [null, "{not json", JSON.stringify({ orders: [] })]) {
    const path = join(makeTempDir(), "cases.json");
    if (content !== null) writeFileSync(path, content);
    const s = { ...spec, heldOutPath: path };
    const sha = content === null ? "x" : sha256File(path);
    const r = verifyCandidate({ runner: hostRunner, spec: s, armDir: buildArm(spec, "A0").dir, candidateDir: ws.dir, expectedChecksSha256: sha });
    assert.equal(r.verdict, "unknown", String(content));
  }
});

test("every declared protected file is enforced", () => {
  for (const p of spec.protectedPaths) {
    const ws = buildArm(spec, "A0");
    applyFixture(FIXTURES, "good-bigint", ws.dir);
    appendFileSync(join(ws.dir, p), p.endsWith(".json") ? " " : "\n// x\n");
    const r = verifyCandidate({ runner: hostRunner, spec, armDir: buildArm(spec, "A0").dir, candidateDir: ws.dir, expectedChecksSha256: checksSha });
    assert.equal(r.verdict, "fail", p);
    assert.ok(r.reasons.some((x) => x.includes(`${p}: protected file modified`)), p);
  }
});

test("an exporter that rewrites a protected test during verification fails", () => {
  const dir = goodCandidateWithPostprocess(`(h, rows) => { writeFileSync("test/decoder.test.ts", 'import { test } from "node:test";\\ntest("ok", () => {});\\n'); return [h, ...rows]; }`);
  const r = verifyCandidate({ runner: hostRunner, spec, armDir: buildArm(spec, "A0").dir, candidateDir: dir, expectedChecksSha256: checksSha });
  assert.equal(r.verdict, "fail");
  assert.ok(r.reasons.some((x) => x.startsWith("tampering during export: test/decoder.test.ts")), r.reasons.join("\n"));
});

test("a correct exporter with no new tests fails", () => {
  const ws = buildArm(spec, "A0");
  applyFixture(FIXTURES, "good-bigint", ws.dir);
  for (const f of readdirSync(join(ws.dir, "test"))) if (f.startsWith("export")) rmSync(join(ws.dir, "test", f));
  const r = verifyCandidate({ runner: hostRunner, spec, armDir: buildArm(spec, "A0").dir, candidateDir: ws.dir, expectedChecksSha256: checksSha });
  assert.equal(r.verdict, "fail");
  assert.ok(r.reasons.some((x) => x.includes("no new test files")), r.reasons.join("\n"));
});
