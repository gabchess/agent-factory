import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

export function listFiles(root: string, opts: { includeGit?: boolean } = {}): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!opts.includeGit && entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(relative(root, full).split(sep).join("/"));
    }
  };
  walk(root);
  return out.sort();
}

export function copyTree(from: string, to: string, opts: { includeGit?: boolean } = {}): void {
  cpSync(from, to, {
    recursive: true,
    filter: (src) => opts.includeGit === true || !relative(from, src).split(sep).includes(".git"),
  });
}

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

export function hashTree(root: string): string {
  const h = createHash("sha256");
  for (const file of listFiles(root)) {
    h.update(file).update("\0").update(readFileSync(join(root, file))).update("\0");
  }
  return h.digest("hex");
}

export function makeTempDir(prefix = "run-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
