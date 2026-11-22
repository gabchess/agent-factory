import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../util/fs.ts";
import { FOCUS_OR_DISABLE_PATTERNS } from "./node-test-report.ts";

export interface TamperFinding {
  path: string;
  detail: string;
}

export function findTampering(armDir: string, candidateDir: string, protectedPaths: string[]): TamperFinding[] {
  const out: TamperFinding[] = [];
  for (const path of protectedPaths) {
    const candidate = join(candidateDir, path);
    if (!existsSync(candidate)) {
      out.push({ path, detail: "protected file deleted" });
    } else if (!readFileSync(candidate).equals(readFileSync(join(armDir, path)))) {
      out.push({ path, detail: "protected file modified" });
    }
  }
  for (const file of listFiles(candidateDir)) {
    if (file.includes("node_modules/") || !/\.(test|spec)\.(ts|js|mjs)$/.test(file)) continue;
    const text = readFileSync(join(candidateDir, file), "utf8");
    for (const p of FOCUS_OR_DISABLE_PATTERNS) {
      const m = text.match(p);
      if (m) out.push({ path: file, detail: `focused or disabled test: "${m[0]}"` });
    }
  }
  return out;
}
