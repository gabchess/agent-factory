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

export function stagedRepo() {
  const entries = execFileSync("git", ["ls-files", "-z", "--stage"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [meta, path] = entry.split("\t");
      const [mode, object, stage] = meta.split(" ");
      return { mode, object, stage, path };
    })
    .filter(({ mode, stage }) => (mode === "100644" || mode === "100755") && stage === "0");
  const blobs = readBlobs(entries.map(({ object }) => object));
  const texts = new Map(entries.map(({ path }, index) => [path, blobs[index]]));
  const read = (path) => (path.startsWith(FIXTURES) || texts.get(path).includes("\0") ? null : texts.get(path));
  return createRepo([...texts.keys()], read);
}
