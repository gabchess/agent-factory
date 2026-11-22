// CONNECT-only forward proxy. Tunnels TLS to allowlisted host:443 and refuses everything else.
// Every decision is logged as one JSON line so a run's egress can be audited.
import { createServer } from "node:http";
import { connect } from "node:net";

const allow = new Set((process.env.ALLOW_HOSTS ?? "api.anthropic.com").split(",").map((h) => h.trim().toLowerCase()));
const log = (o) => console.log(JSON.stringify({ at: new Date().toISOString(), ...o }));

const server = createServer((req, res) => {
  log({ decision: "deny", method: req.method, url: req.url, reason: "only CONNECT is allowed" });
  res.writeHead(403).end("egress denied\n");
});
server.on("connect", (req, client, head) => {
  const [host, port] = String(req.url).toLowerCase().split(":");
  if (!allow.has(host) || port !== "443") {
    log({ decision: "deny", method: "CONNECT", target: req.url });
    client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  log({ decision: "allow", method: "CONNECT", target: req.url });
  const upstream = connect(443, host, () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  upstream.on("error", () => client.destroy());
  client.on("error", () => upstream.destroy());
});
server.listen(3128, () => log({ decision: "listening", allow: [...allow] }));
