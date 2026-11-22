import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(import.meta.dirname, "..");
const SCOPE = ["src", "scripts", "test"];
const BASELINE = join(ROOT, "comment-baseline.json");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith(".ts") ? [p] : [];
  });
}

export function commentLines(source: string): number {
  const file = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, false);
  const ranges = new Map<number, ts.CommentRange>();
  const collect = (pos: number) => {
    for (const r of [...(ts.getLeadingCommentRanges(source, pos) ?? []), ...(ts.getTrailingCommentRanges(source, pos) ?? [])]) ranges.set(r.pos, r);
  };
  const visit = (node: ts.Node) => {
    collect(node.getFullStart());
    collect(node.getEnd());
    node.getChildren(file).forEach(visit);
  };
  visit(file);
  const lines = new Set<number>();
  for (const r of ranges.values()) {
    const start = file.getLineAndCharacterOfPosition(r.pos).line;
    const end = file.getLineAndCharacterOfPosition(r.end).line;
    for (let l = start; l <= end; l++) lines.add(l);
  }
  return lines.size;
}

export function countAll(root = ROOT): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const dir of SCOPE) {
    for (const f of files(join(root, dir)).sort()) {
      const n = commentLines(readFileSync(f, "utf8"));
      if (n > 0) counts[relative(root, f)] = n;
    }
  }
  return counts;
}

export function check(counts: Record<string, number>, baseline: Record<string, number>): string[] {
  return Object.entries(counts)
    .filter(([f, n]) => n > (baseline[f] ?? 0))
    .map(([f, n]) => `${f}: ${n} comment lines, baseline allows ${baseline[f] ?? 0}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const counts = countAll();
  if (!existsSync(BASELINE)) {
    console.error(`${relative(ROOT, BASELINE)} is missing; restore it from git rather than regenerating it from the current comments`);
    process.exit(1);
  }
  const baseline: Record<string, number> = JSON.parse(readFileSync(BASELINE, "utf8"));
  if (process.argv.includes("--update")) {
    const problems = check(counts, baseline);
    if (problems.length) {
      console.error(`refusing to raise the baseline:\n${problems.join("\n")}`);
      process.exit(1);
    }
    writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`baseline lowered to ${Object.values(counts).reduce((a, b) => a + b, 0)} comment lines`);
  } else {
    const problems = check(counts, baseline);
    if (problems.length) {
      console.error(`new comments in ${SCOPE.join(", ")}; see docs/decisions/0011-comments-are-a-ratchet.md:\n${problems.join("\n")}`);
      process.exit(1);
    }
    console.log(`ok: ${Object.values(counts).reduce((a, b) => a + b, 0)} comment lines, at or under baseline`);
  }
}
