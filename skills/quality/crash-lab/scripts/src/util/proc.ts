import { spawnSync } from "node:child_process";

export interface ProcResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface Mount {
  host: string;
  container: string;
  readOnly?: boolean;
}

export function runProcess(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; input?: string } = {},
): ProcResult {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    timeout: opts.timeoutMs ?? 60_000,
    input: opts.input,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const timedOut = (r.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
  const startError = r.error && !timedOut ? `${r.stderr ? "\n" : ""}${cmd} could not run: ${r.error.message}` : "";
  return { code: r.status, stdout: r.stdout ?? "", stderr: `${r.stderr ?? ""}${startError}`, timedOut };
}

export function sandboxEnv(home: string): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: home, LANG: "C.UTF-8", NODE_OPTIONS: "", NO_COLOR: "1" };
}

export interface CandidateRunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  mounts: Mount[];
}

export type CandidateRunner = (cmd: string, args: string[], opts: CandidateRunOptions) => ProcResult;

export const hostRunner: CandidateRunner = (cmd, args, opts) => runProcess(cmd, args, opts);
