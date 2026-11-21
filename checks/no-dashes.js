import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DASHES = { "\u2014": "em dash", "\u2013": "en dash" };
const FIXTURES = "test/fixtures/";

export function findDashes(text) {
  return text.split("\n").flatMap((content, index) =>
    [...content.matchAll(/[\u2014\u2013]/g)].map((match) => ({
      line: index + 1,
      column: match.index + 1,
      dash: DASHES[match[0]],
    })),
  );
}

function repoFiles() {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
    .split("\0")
    .filter((path) => path && !path.startsWith(FIXTURES) && existsSync(path));
}

const isBinary = (text) => text.includes("\0");

function main() {
  const failures = repoFiles().flatMap((path) => {
    const text = readFileSync(path, "utf8");
    return isBinary(text) ? [] : findDashes(text).map(
      ({ line, column, dash }) =>
        `${path}:${line}:${column}: ${dash}. Rewrite the sentence with a comma, colon, period or parentheses. Write ranges as "44 to 51".`,
    );
  });
  failures.forEach((failure) => console.error(failure));
  process.exitCode = failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
