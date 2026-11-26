import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MARK = "Installed by `npm run hooks`.";
const SHIM = `#!/bin/sh
# ${MARK} It runs checks/pre-commit.sh from the checkout being committed.
hook="$(git rev-parse --show-toplevel)/checks/pre-commit.sh"
if [ ! -f "$hook" ]; then
  echo "pre-commit refused: $hook is missing, so no check ran. Fix: rebase this branch onto main, which has it, then commit again." >&2
  exit 1
fi
exec sh "$hook" "$@"
`;

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const hooksPath = () => {
  try {
    return git("config", "--get", "core.hooksPath");
  } catch {
    return "";
  }
};

const hooks = join(resolve(git("rev-parse", "--git-common-dir")), "hooks");
const hook = join(hooks, "pre-commit");

if (existsSync(hook) && !readFileSync(hook, "utf8").includes(MARK)) {
  console.error(`${hook} holds another pre-commit hook. Move it out, or call it from checks/pre-commit.sh, then run npm run hooks again.`);
  process.exitCode = 1;
} else {
  mkdirSync(hooks, { recursive: true });
  writeFileSync(hook, SHIM);
  chmodSync(hook, 0o755);
  console.log(`Installed ${hook}.`);
  const path = hooksPath();
  if (path) console.log(`core.hooksPath is ${path}, so git runs the pre-commit hook there. It must chain to ${hook}, or the checks never run.`);
}
