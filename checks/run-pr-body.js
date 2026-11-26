import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const USAGE = 'Pass the body as a file or on stdin: node checks/run-pr-body.js --head "$(git rev-parse HEAD)" --command "npm test" --command "npm run check" body.md';

function options() {
  try {
    return parseArgs({ allowPositionals: true, options: { head: { type: "string" }, command: { type: "string", multiple: true } } });
  } catch (error) {
    return { error: `${error.message} ${USAGE}` };
  }
}

// A fresh clone has no node_modules yet, and the check reads bodies with markdown-it.
async function load() {
  try {
    return await import("./pr-body.js");
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !error.message.includes("markdown-it")) throw error;
    return { error: `The PR body check reads bodies with markdown-it, which this clone lacks. Run "npm ci --ignore-scripts" in ${fileURLToPath(new URL("..", import.meta.url))}, then run this again.` };
  }
}

const { values = {}, positionals = [], error } = options();
const { check, error: missing } = await load();
if (error || missing) {
  console.error(error ?? missing);
  process.exitCode = 2;
} else if (values.head !== undefined && !/^[0-9a-f]{40}$/.test(values.head)) {
  console.error(`Pass the full 40 character head SHA: --head "$(git rev-parse HEAD)". ${USAGE}`);
  process.exitCode = 2;
} else if (!positionals.length && process.stdin.isTTY) {
  console.error(USAGE);
  process.exitCode = 2;
} else {
  const commands = values.command ?? [];
  const failures = check(readFileSync(positionals[0] ?? 0, "utf8"), { head: values.head, commands });
  failures.forEach((failure) => console.error(`PR body: ${failure}`));
  const quoted = [values.head && `names the head ${values.head}`, commands.length && "quotes each check command with its output"].filter(Boolean);
  if (!failures.length) console.log(`PR body: it fills the pr skill's template${quoted.length ? ` and ${quoted.join(" and ")}` : ""}.`);
  process.exitCode = failures.length ? 1 : 0;
}
