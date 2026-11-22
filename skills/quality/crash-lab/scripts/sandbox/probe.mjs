// Runs inside a sandbox (or on the host, as a control) and reports what it can see and reach.
// Usage: node probe.mjs '<json config>'  where config = { hostPaths: string[], needles: string[] }
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { connect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { lookup } from "node:dns/promises";
import { join } from "node:path";

const cfg = JSON.parse(process.argv[2]);
const out = { hostPaths: {}, needleHits: [], envKeys: Object.keys(process.env).sort(), mounts: [], net: {} };

for (const p of cfg.hostPaths) out.hostPaths[p] = existsSync(p);

try {
  out.mounts = readFileSync("/proc/self/mountinfo", "utf8").split("\n").filter(Boolean)
    .map((l) => l.split(" ")[4]).filter((m) => !/^\/(proc|sys|dev)(\/|$)/.test(m));
} catch { out.mounts = ["unreadable"]; }

const skip = new Set(["/proc", "/sys", "/dev"]);
let scanned = 0;
const walk = (dir) => {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (skip.has(p)) continue;
    if (e.isDirectory()) walk(p);
    else if (e.isFile()) {
      try {
        if (statSync(p).size > 8 * 1024 * 1024) continue;
        const text = readFileSync(p, "latin1");
        scanned++;
        for (const n of cfg.needles) if (text.includes(n)) out.needleHits.push({ path: p, needle: n });
      } catch { /* unreadable */ }
    }
  }
};
for (const root of cfg.scanRoots ?? ["/"]) walk(root);
out.filesScanned = scanned;

const withTimeout = (p, ms = 8000, sockets = []) => {
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => { for (const s of sockets) s.destroy(); rej(new Error("timeout")); }, ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
};
const tcp = (host, port) => {
  const sockets = [];
  return withTimeout(new Promise((res, rej) => {
    const s = connect(port, host, () => { s.destroy(); res("connected"); });
    sockets.push(s);
    s.on("error", (e) => rej(e));
  }), 8000, sockets);
};
const viaProxy = (proxy, target) => {
  const sockets = [];
  return withTimeout(new Promise((res, rej) => {
  const u = new URL(proxy);
  const s = connect(Number(u.port), u.hostname, () => s.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`));
  sockets.push(s);
  s.once("data", (d) => {
    const status = d.toString().split(" ")[1];
    if (status !== "200") { s.destroy(); return res(`proxy ${status}`); }
    const [host] = target.split(":");
    const t = tlsConnect({ socket: s, servername: host }, () => t.write(`GET /v1/models HTTP/1.1\r\nHost: ${host}\r\nanthropic-version: 2023-06-01\r\nConnection: close\r\n\r\n`));
    sockets.push(t);
    t.once("data", (r) => { t.destroy(); res(`tunnel ok, upstream ${r.toString().split(" ")[1]}`); });
    t.on("error", rej);
  });
  s.on("error", rej);
  }), 8000, sockets);
};
const settle = async (f) => { try { return await f(); } catch (e) { return `error: ${e.code ?? e.message}`; } };
const proxy = process.env.HTTPS_PROXY;
if (proxy) {
  out.net.proxyToAnthropic = await settle(() => viaProxy(proxy, "api.anthropic.com:443"));
  out.net.proxyToExample = await settle(() => viaProxy(proxy, "example.com:443"));
  out.net.proxyToOpenAI = await settle(() => viaProxy(proxy, "api.openai.com:443"));
  out.net.proxyToAnthropicPort80 = await settle(() => viaProxy(proxy, "api.anthropic.com:80"));
}
out.net.dnsExample = await settle(async () => (await withTimeout(lookup("example.com"))).address);
out.net.directIp = await settle(() => tcp("1.1.1.1", 443));
out.net.directAnthropic = await settle(() => tcp("api.anthropic.com", 443));
console.log(JSON.stringify(out));
