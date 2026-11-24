import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { check } from "./deny-list.js";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const template = (file) => read(new URL(`../templates/deny-list/${file}`, import.meta.url));

const path = process.argv[2];
if (path === undefined) {
  console.error("Pass the settings file: npm run check:deny -- ~/.claude/settings.json");
  process.exitCode = 2;
} else {
  const failures = check(read(path), template("list.json"), template("claude-code.json"), homedir());
  failures.forEach((failure) => console.error(`${path}: ${failure}`));
  if (!failures.length) console.log(`${path}: every deny rule in templates/deny-list/ is present.`);
  process.exitCode = failures.length ? 1 : 0;
}
