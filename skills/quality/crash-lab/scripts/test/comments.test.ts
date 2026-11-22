import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, commentLines, countAll } from "../scripts/comment-ratchet.ts";

test("comment lines are counted from real comments, not strings or templates", () => {
  const src = 'const a = 1; // one\n/** two\n * three */\nconst u = `http://x ${a} //no`;\nconst s = "//no";\n';
  assert.equal(commentLines(src), 3);
});

test("a file over its baseline, or a new file with comments, fails the ratchet", () => {
  assert.deepEqual(check({}, {}), []);
  for (const dir of ["src", "scripts", "test"]) {
    assert.deepEqual(check({ [`${dir}/a.ts`]: 2 }, { [`${dir}/a.ts`]: 2 }), []);
    assert.deepEqual(check({ [`${dir}/a.ts`]: 1 }, { [`${dir}/a.ts`]: 2 }), []);
    assert.deepEqual(check({ [`${dir}/a.ts`]: 3 }, { [`${dir}/a.ts`]: 2 }), [`${dir}/a.ts: 3 comment lines, baseline allows 2`]);
    assert.deepEqual(check({ [`${dir}/new.ts`]: 1 }, {}), [`${dir}/new.ts: 1 comment lines, baseline allows 0`]);
  }
});

test("counts all scoped TypeScript files recursively and excludes other inputs", () => {
  const root = mkdtempSync(join(tmpdir(), "comment-scope-"));
  try {
    for (const dir of ["src", "scripts", "test", "cases", "fixtures", "checks"]) mkdirSync(join(root, dir));
    assert.deepEqual(countAll(root), {});
    const expected: Record<string, number> = {};
    for (const dir of ["src", "scripts", "test"]) {
      mkdirSync(join(root, dir, "nested"));
      writeFileSync(join(root, dir, "nested", "a.ts"), "// counted\nconst n = 1;\n");
      writeFileSync(join(root, dir, "empty.ts"), "export {};\n");
      writeFileSync(join(root, dir, "ignored.js"), "// ignored\n");
      expected[`${dir}/nested/a.ts`] = 1;
    }
    for (const dir of ["cases", "fixtures", "checks"]) writeFileSync(join(root, dir, "input.ts"), "// frozen\n");
    assert.deepEqual(countAll(root), expected);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("src, scripts and test stay at or under the committed comment baseline", () => {
  const baseline = JSON.parse(readFileSync(new URL("../comment-baseline.json", import.meta.url), "utf8"));
  assert.deepEqual(check(countAll(), baseline), []);
});
