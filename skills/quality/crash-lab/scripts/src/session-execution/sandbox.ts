import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runProcess, type Mount, type ProcResult } from "../util/proc.ts";

export type { Mount };

export const SANDBOX_IMAGE = "crashlab-sandbox:2.1.329";
export const INTERNAL_NETWORK = "crashlab-internal";
export const EGRESS_NETWORK = "crashlab-egress-net";
export const PROXY_NAME = "crashlab-egress";
export const PROXY_URL = `http://${PROXY_NAME}:3128`;
export const CONTAINER_PATH = "/usr/local/bin:/usr/bin:/bin";
const PROXY_SCRIPT = fileURLToPath(new URL("../../sandbox/egress-proxy.mjs", import.meta.url));
const DOCKERFILE_DIR = fileURLToPath(new URL("../../sandbox", import.meta.url));

export function docker(args: string[], timeoutMs = 120_000): ProcResult {
  return runProcess("docker", args, { timeoutMs });
}

function ensureNetwork(name: string, createArgs: string[] = []): void {
  if (docker(["network", "inspect", name]).code === 0) return;
  const r = docker(["network", "create", ...createArgs, name]);
  if (r.code !== 0) throw new Error(`docker network ${name} could not be created: ${r.stderr.slice(-300)}`);
}

export function dockerAvailable(): boolean {
  return docker(["info", "--format", "{{.ServerVersion}}"], 15_000).code === 0;
}

export function ensureImage(): void {
  if (docker(["image", "inspect", SANDBOX_IMAGE]).code === 0) return;
  const r = docker(["build", "-q", "-t", SANDBOX_IMAGE, DOCKERFILE_DIR], 900_000);
  if (r.code !== 0) throw new Error(`sandbox image build failed: ${r.stderr.slice(-500)}`);
}

export function ensureEgress(allowHosts = ["api.anthropic.com"]): void {
  ensureImage();
  ensureNetwork(INTERNAL_NETWORK, ["--internal"]);
  ensureNetwork(EGRESS_NETWORK);
  const running = docker(["inspect", "-f", "{{.State.Running}} {{index .Config.Labels \"allow\"}}", PROXY_NAME]);
  if (running.code === 0 && running.stdout.trim() === `true ${allowHosts.join(",")}`) return;
  docker(["rm", "-f", PROXY_NAME]);
  const r = docker([
    "run", "-d", "--name", PROXY_NAME, "--label", `allow=${allowHosts.join(",")}`,
    "--network", EGRESS_NETWORK, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--user", "1000:1000", "-e", `ALLOW_HOSTS=${allowHosts.join(",")}`,
    "-v", `${PROXY_SCRIPT}:/proxy/egress-proxy.mjs:ro`, SANDBOX_IMAGE, "node", "/proxy/egress-proxy.mjs",
  ]);
  if (r.code !== 0) throw new Error(`egress proxy failed to start: ${r.stderr.slice(-500)}`);
  const c = docker(["network", "connect", INTERNAL_NETWORK, PROXY_NAME]);
  if (c.code !== 0) throw new Error(`egress proxy could not join ${INTERNAL_NETWORK}: ${c.stderr.slice(-300)}`);
}

export function proxyLog(since?: string): string {
  return docker(["logs", ...(since ? ["--since", since] : []), PROXY_NAME]).stdout;
}

export function containerName(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

export function runArgs(opts: { name: string; network: "none" | typeof INTERNAL_NETWORK; mounts: Mount[]; env: Record<string, string | null>; workdir: string; interactive?: boolean }): string[] {
  const args = [
    "run", "--rm", "--name", opts.name, "--network", opts.network,
    "--read-only", "--tmpfs", "/tmp:rw,size=256m", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--pids-limit", "512", "--memory", "2g", "--cpus", "2", "--user", "1000:1000", "-w", opts.workdir,
  ];
  if (opts.interactive) args.push("-i");
  for (const m of opts.mounts) args.push("-v", `${m.host}:${m.container}${m.readOnly ? ":ro" : ""}`);
  for (const [k, v] of Object.entries(opts.env)) args.push("-e", v === null ? k : `${k}=${v}`);
  args.push(SANDBOX_IMAGE);
  return args;
}

export function runCandidateInSandbox(
  cmd: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; mounts: Mount[] },
): ProcResult {
  ensureImage();
  const name = containerName("verify");
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.env ?? {})) if (v !== undefined) env[k] = v;
  env.PATH = CONTAINER_PATH;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const secs = String(Math.ceil(timeoutMs / 1000));
  const r = docker([...runArgs({ name, network: "none", mounts: opts.mounts, env, workdir: opts.cwd }), "timeout", "-s", "KILL", secs, cmd, ...args], timeoutMs + 30_000);
  if (r.timedOut) docker(["rm", "-f", name]);
  return { ...r, timedOut: r.timedOut || r.code === 137 };
}

export function sessionEnv(): Record<string, string | null> {
  return {
    HOME: "/home/dev",
    PATH: CONTAINER_PATH,
    LANG: "C.UTF-8",
    NO_COLOR: "1",
    ANTHROPIC_API_KEY: null,
    HTTPS_PROXY: PROXY_URL,
    HTTP_PROXY: PROXY_URL,
    DISABLE_TELEMETRY: "1",
    DISABLE_ERROR_REPORTING: "1",
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  };
}

export function sessionMounts(workdir: string, home: string): Mount[] {
  return [{ host: workdir, container: "/work" }, { host: home, container: "/home/dev" }];
}

export const dockerRunner = (cmd: string, args: string[], opts: Parameters<typeof runCandidateInSandbox>[2]): ProcResult =>
  runCandidateInSandbox(cmd, args, opts);
