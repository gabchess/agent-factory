import { copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildArm } from "../experiment-design/arms.ts";
import type { CaseSpec } from "../experiment-design/case.ts";
import { makeTempDir } from "../util/fs.ts";
import { runProcess } from "../util/proc.ts";
import {
  CONTAINER_PATH, containerName, docker, ensureEgress, INTERNAL_NETWORK, proxyLog, runArgs, runCandidateInSandbox, sessionEnv, sessionMounts,
} from "./sandbox.ts";

const PROBE = fileURLToPath(new URL("../../sandbox/probe.mjs", import.meta.url));
const PROBE_INVALID_KEY = "sk-ant-crashlab-probe-invalid";
const LAB_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export interface ProbeCheck {
  where: "session" | "verification" | "host-control" | "claude-code" | "loading";
  check: string;
  expected: string;
  actual: string;
  ok: boolean;
}

type ProbeOut = {
  hostPaths: Record<string, boolean>;
  needleHits: { path: string; needle: string }[];
  envKeys: string[];
  mounts: string[];
  net: Record<string, string>;
  filesScanned: number;
};

export function probeSandbox(spec: CaseSpec, checksSha256: string): { checks: ProbeCheck[]; raw: Record<string, unknown> } {
  ensureEgress();
  const since = new Date(Date.now() - 1000).toISOString();
  const hostPaths = [
    LAB_ROOT,
    spec.heldOutPath,
    join(LAB_ROOT, "experiments"),
    join(LAB_ROOT, "src/artifact-verification/oracle.ts"),
    homedir(),
    "/var/run/docker.sock",
  ];
  const needles = ["9007199254740990", "90071992547409.90", checksSha256];
  const probeDir = makeTempDir("probe-");
  copyFileSync(PROBE, join(probeDir, "probe.mjs"));
  const probeMount = { host: probeDir, container: "/probe", readOnly: true };
  const cfg = (scanRoots: string[]) => JSON.stringify({ hostPaths, needles, scanRoots });
  const parse = (stdout: string, stderr: string): ProbeOut => {
    try {
      return JSON.parse(stdout.trim().split("\n").pop() ?? "");
    } catch {
      throw new Error(`probe produced no report: ${stderr.slice(-400)}`);
    }
  };

  const ws = buildArm(spec, spec.arms[0].id);
  const home = makeTempDir("home-");
  const sessionName = containerName("probe-session");
  const session = docker(
    [...runArgs({ name: sessionName, network: INTERNAL_NETWORK, mounts: [...sessionMounts(ws.dir, home), probeMount], env: sessionEnv(), workdir: "/work" }), "node", "/probe/probe.mjs", cfg(["/"])],
    300_000,
  );
  const sessionOut = parse(session.stdout, session.stderr);

  const vws = buildArm(spec, spec.arms[0].id);
  const verify = runCandidateInSandbox("node", [join(probeDir, "probe.mjs"), cfg(["/"])], {
    cwd: vws.dir,
    timeoutMs: 240_000,
    mounts: [{ host: vws.dir, container: vws.dir }, { host: probeDir, container: probeDir, readOnly: true }],
  });
  const verifyOut = parse(verify.stdout, verify.stderr);

  const host = runProcess("node", [PROBE, cfg([join(LAB_ROOT, "checks")])], { cwd: ws.dir, env: { PATH: process.env.PATH }, timeoutMs: 120_000 });
  const hostOut = parse(host.stdout, host.stderr);

  const claudeHome = makeTempDir("home-");
  const claudeWs = buildArm(spec, spec.arms[0].id);
  const claude = docker(
    [
      ...runArgs({ name: containerName("probe-claude"), network: INTERNAL_NETWORK, mounts: sessionMounts(claudeWs.dir, claudeHome), env: { ...sessionEnv(), ANTHROPIC_API_KEY: PROBE_INVALID_KEY }, workdir: "/work" }),
      "claude", "-p", "Reply with OK.", "--model", "claude-haiku-5-5", "--output-format", "json", "--max-turns", "1", "--strict-mcp-config", "--no-session-persistence",
    ],
    120_000,
  );
  const egress = proxyLog(since).split("\n").filter(Boolean).map((l) => {
    try {
      return JSON.parse(l) as { decision: string; target?: string; url?: string };
    } catch {
      return { decision: "unparsed", target: l };
    }
  });

  const checks: ProbeCheck[] = [];
  const add = (where: ProbeCheck["where"], check: string, expected: string, actual: string, ok: boolean) => checks.push({ where, check, expected, actual, ok });
  const isErr = (v: string | undefined) => typeof v === "string" && v.startsWith("error:");
  const allowedSessionMounts = new Set(["/", "/work", "/home/dev", "/tmp", "/probe", "/etc/hosts", "/etc/hostname", "/etc/resolv.conf"]);
  const allowedSessionEnv = new Set([...Object.keys(sessionEnv()), "HOSTNAME", "PWD", "NODE_VERSION", "YARN_VERSION"]);

  for (const [where, out, net] of [["session", sessionOut, true], ["verification", verifyOut, false]] as const) {
    for (const [p, seen] of Object.entries(out.hostPaths)) add(where, `host path ${p}`, "not visible", seen ? "visible" : "not visible", !seen);
    add(where, `needles (held-out values, expected outputs, checks hash) in ${out.filesScanned} files`, "0 hits", `${out.needleHits.length} hits${out.needleHits.length ? `: ${out.needleHits.slice(0, 3).map((h) => h.path).join(", ")}` : ""}`, out.needleHits.length === 0);
    if (where === "session") {
      const extra = out.mounts.filter((m) => !allowedSessionMounts.has(m));
      add(where, "mount points", "only /, /work, /home/dev, /tmp, /probe and docker's /etc files", extra.length ? `extra: ${extra.join(", ")}` : out.mounts.join(", "), extra.length === 0);
      const extraEnv = out.envKeys.filter((k) => !allowedSessionEnv.has(k));
      add(where, "environment variables", "only the session allowlist", extraEnv.length ? `extra: ${extraEnv.join(", ")}` : out.envKeys.join(", "), extraEnv.length === 0);
    }
    if (net) {
      add(where, "proxy CONNECT api.anthropic.com:443", "tunnel ok", out.net.proxyToAnthropic, /^tunnel ok/.test(out.net.proxyToAnthropic ?? ""));
      add(where, "proxy CONNECT example.com:443", "proxy 403", out.net.proxyToExample, out.net.proxyToExample === "proxy 403");
      add(where, "proxy CONNECT api.openai.com:443", "proxy 403", out.net.proxyToOpenAI, out.net.proxyToOpenAI === "proxy 403");
      add(where, "proxy CONNECT api.anthropic.com:80", "proxy 403", out.net.proxyToAnthropicPort80, out.net.proxyToAnthropicPort80 === "proxy 403");
    }
    add(where, "DNS lookup example.com", "error", out.net.dnsExample, isErr(out.net.dnsExample));
    add(where, "direct TCP 1.1.1.1:443", "error", out.net.directIp, isErr(out.net.directIp));
    add(where, "direct TCP api.anthropic.com:443 (no proxy)", "error", out.net.directAnthropic, isErr(out.net.directAnthropic));
  }

  add("host-control", `held-out checks file ${spec.heldOutPath}`, "visible (proves the probe can see it)", hostOut.hostPaths[spec.heldOutPath] ? "visible" : "not visible", hostOut.hostPaths[spec.heldOutPath] === true);
  add("host-control", "needle hits in checks/", ">= 1 (proves the scan finds held-out values)", String(hostOut.needleHits.length), hostOut.needleHits.length > 0);

  const claudeText = `${claude.stdout}\n${claude.stderr}`;
  const authRejected = /invalid.{0,20}(api.?key|x-api-key)|authentication|401/i.test(claudeText);
  add("claude-code", "claude -p with an invalid key", "reaches the API and is rejected (no spend)", authRejected ? "rejected by the API" : claudeText.trim().slice(0, 200), authRejected);
  const unparsed = egress.filter((e) => e.decision === "unparsed").map((e) => e.target);
  add("claude-code", "proxy log: unparsed lines", "0", unparsed.length ? `${unparsed.length}: ${unparsed.slice(0, 2).join(" | ").slice(0, 200)}` : "0", unparsed.length === 0);
  const allowed = egress.filter((e) => e.decision === "allow").map((e) => e.target);
  const denied = egress.filter((e) => e.decision === "deny").map((e) => e.target ?? e.url);
  add("claude-code", "proxy log: allowed tunnels", "only api.anthropic.com:443", [...new Set(allowed)].join(", ") || "none", allowed.length > 0 && allowed.every((t) => t === "api.anthropic.com:443"));
  add("claude-code", "proxy log: denied requests", "only the probe's own deliberate denials", [...new Set(denied)].join(", ") || "none",
    denied.every((t) => ["example.com:443", "api.openai.com:443", "api.anthropic.com:80"].includes(String(t))));

  return { checks, raw: { session: sessionOut, verification: verifyOut, hostControl: hostOut, claude: { code: claude.code, out: claudeText.slice(0, 1500) }, egress, containerPath: CONTAINER_PATH } };
}

export function renderProbe(checks: ProbeCheck[]): string {
  const lines = ["# Sandbox probe", "", `${checks.filter((c) => c.ok).length}/${checks.length} checks as expected.`, "", "| Where | Check | Expected | Actual | OK |", "|---|---|---|---|---|"];
  for (const c of checks) lines.push(`| ${c.where} | ${c.check} | ${c.expected} | ${c.actual.replace(/\|/g, "\\|")} | ${c.ok ? "yes" : "**no**"} |`);
  return lines.join("\n") + "\n";
}

