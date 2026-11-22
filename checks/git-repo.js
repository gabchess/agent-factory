import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { createRepo } from "./repo.js";

const FIXTURES = "test/fixtures/";

const isFile = (path) => lstatSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

function readText(path) {
  if (path.startsWith(FIXTURES)) return null;
  const text = readFileSync(path, "utf8");
  return text.includes("\0") ? null : text;
}

export function gitRepo() {
  const paths = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
    .split("\0")
    .filter((path) => path && isFile(path));
  return createRepo(paths, readText);
}
