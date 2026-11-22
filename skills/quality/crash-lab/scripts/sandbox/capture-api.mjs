// Stand-in for the Anthropic API used by the loading probe: records each request body, then answers 401.
// Claude Code talks to it through ANTHROPIC_BASE_URL inside a --network none container, so nothing is spent.
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const out = process.argv[2];
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    appendFileSync(out, JSON.stringify({ method: req.method, url: req.url, body }) + "\n");
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "loading probe" } }));
  });
}).listen(8099, "127.0.0.1");
