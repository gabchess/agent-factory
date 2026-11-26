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

const BLOB = /^[0-9a-f]+ blob (\d+)$/;

function readBlobs(objects) {
  if (!objects.length) return [];
  const out = execFileSync("git", ["cat-file", "--batch"], { input: `${objects.join("\n")}\n`, maxBuffer: 1 << 30 });
  let at = 0;
  return objects.map((object) => {
    const end = out.indexOf(10, at);
    const size = BLOB.exec(out.toString("latin1", at, end))?.[1];
    if (size === undefined) throw new Error(`git cat-file could not read the staged blob ${object}.`);
    at = end + 1 + Number(size) + 1;
    return out.toString("utf8", end + 1, at - 1);
  });
}

// The tree the commit will record: `git write-tree` leaves out a file marked with `git add -N`, as the commit does.
export function stagedRepo() {
  const tree = execFileSync("git", ["write-tree"], { encoding: "utf8" }).trim();
  const entries = execFileSync("git", ["ls-tree", "-r", "-z", tree], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const tab = entry.indexOf("\t");
      const [mode, type, object] = entry.slice(0, tab).split(" ");
      return { mode, type, object, path: entry.slice(tab + 1) };
    })
    .filter(({ mode, type }) => type === "blob" && (mode === "100644" || mode === "100755"));
  const blobs = readBlobs(entries.map(({ object }) => object));
  const texts = new Map(entries.map(({ path }, index) => [path, blobs[index]]));
  const read = (path) => (path.startsWith(FIXTURES) || texts.get(path).includes("\0") ? null : texts.get(path));
  return createRepo([...texts.keys()], read);
}
