import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRepo } from "../checks/repo.js";

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));

export function fixture(check, kind) {
  const root = join(FIXTURES, check, kind);
  const paths = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split("\\").join("/"))
    .sort();
  return createRepo(paths, (path) => readFileSync(join(root, path), "utf8"));
}
