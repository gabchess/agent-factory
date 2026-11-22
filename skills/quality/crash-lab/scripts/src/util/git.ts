import { execFileSync } from "node:child_process";

export const NEUTRAL_IDENTITY = { name: "Developer", email: "dev@example.com" };

const NEUTRAL_ENV = {
  GIT_AUTHOR_NAME: NEUTRAL_IDENTITY.name,
  GIT_AUTHOR_EMAIL: NEUTRAL_IDENTITY.email,
  GIT_COMMITTER_NAME: NEUTRAL_IDENTITY.name,
  GIT_COMMITTER_EMAIL: NEUTRAL_IDENTITY.email,
  GIT_AUTHOR_DATE: "2026-01-05T12:00:00Z",
  GIT_COMMITTER_DATE: "2026-01-05T12:00:00Z",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
};

export const NEUTRAL_COMMIT_MESSAGE = "Initial commit";

const REPOSITORY_LOCATION_ENV = [
  "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR", "GIT_NAMESPACE", "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM",
];

function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of REPOSITORY_LOCATION_ENV) delete env[key];
  return { ...env, ...NEUTRAL_ENV };
}

export function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    env: gitEnv(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function initSingleCommitRepo(dir: string): string {
  git(dir, ["init", "-q", "-b", "main", "--template="]);
  git(dir, ["add", "-A"]);
  git(dir, ["-c", "commit.gpgsign=false", "-c", "maintenance.auto=false", "-c", "gc.auto=0", "commit", "-q", "--no-verify", "-m", NEUTRAL_COMMIT_MESSAGE]);
  return git(dir, ["rev-parse", "HEAD"]);
}
