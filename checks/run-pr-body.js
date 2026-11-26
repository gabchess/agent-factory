import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { check } from "./pr-body.js";

const USAGE = 'Pass the body as a file or on stdin: node checks/run-pr-body.js --head "$(git rev-parse HEAD)" --command "npm test" --command "npm run check" body.md';

function options() {
  try {
    return parseArgs({ allowPositionals: true, options: { head: { type: "string" }, command: { type: "string", multiple: true } } });
  } catch (error) {
    return { error: `${error.message} ${USAGE}` };
  }
}

const { values = {}, positionals = [], error } = options();
if (error) {
  console.error(error);
  process.exitCode = 2;
} else if (values.head !== undefined && !/^[0-9a-f]{40}$/.test(values.head)) {
  console.error(`Pass the full 40 character head SHA: --head "$(git rev-parse HEAD)". ${USAGE}`);
  process.exitCode = 2;
} else if (!positionals.length && process.stdin.isTTY) {
  console.error(USAGE);
  process.exitCode = 2;
} else {
  const failures = check(readFileSync(positionals[0] ?? 0, "utf8"), { head: values.head, commands: values.command ?? [] });
  failures.forEach((failure) => console.error(`PR body: ${failure}`));
  if (!failures.length) console.log(`PR body: the pr skill's sections are there, under the checks' output${values.head ? ` at ${values.head}` : ""}.`);
  process.exitCode = failures.length ? 1 : 0;
}
