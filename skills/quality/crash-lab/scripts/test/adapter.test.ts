import assert from "node:assert/strict";
import fs from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { claudeCodeAdapter } from "../src/adapters/claude-code.ts";
import { makeTempDir } from "../src/util/fs.ts";

const adapter = (dir: string, bin = join(dir, "no-such-claude")) => claudeCodeAdapter({ bin, path: "/usr/bin:/bin", apiKey: "unused", transcriptDir: join(dir, "t"), pinnedVersion: "2.1.329" });
const request = (dir: string) => ({ workdir: dir, home: dir, prompt: "x", model: "m", maxTurns: 1, timeoutMs: 5_000, maxCostUsd: 0.01, slotKey: "main:A0:0" });

test("a missing harness leaves a closed transcript without counting its close toward wall time", { timeout: 10_000 }, async (t) => {
  const dir = makeTempDir();
  let now = 1_000;
  t.mock.method(Date, "now", () => now);
  const close = fs.close;
  const closing = new Promise<() => void>((resolve) => {
    t.mock.method(fs, "close", (fd: number, callback: fs.NoParamCallback) => {
      resolve(() => close(fd, callback));
    });
  });

  const outcome = adapter(dir).run(request(dir));
  const settled = outcome.then(() => true);
  const closeFile = await closing;
  now += request(dir).timeoutMs + 1;
  const returnedBeforeClose = await Promise.race([settled, setImmediate(false)]);
  closeFile();

  const out = await outcome;
  assert.equal(returnedBeforeClose, false);
  assert.equal(out.status, "harness_error");
  assert.match(out.error ?? "", /failed to start/);
  assert.ok(out.transcriptPath);
  assert.equal(fs.readFileSync(out.transcriptPath, "utf8"), "");
  assert.equal(out.usage.wallMs, 0);
});

test("a transcript error waits for the harness and retains its reported cost", { timeout: 10_000 }, async (t) => {
  const dir = makeTempDir();
  const bin = join(dir, "fake-claude");
  const result = JSON.stringify({ type: "result", subtype: "success", total_cost_usd: 0.001 });
  fs.writeFileSync(bin, `#!/bin/sh\nwhile [ ! -e release ]; do sleep 0.01; done\nprintf '%s\\n' '${result}'\n`, { mode: 0o755 });

  const open = fs.open;
  const failed = new Promise<void>((resolve) => {
    t.mock.method(fs, "open", (path: fs.PathLike, flags: fs.OpenMode, mode: fs.Mode, callback: (error: NodeJS.ErrnoException | null, fd: number) => void) => {
      if (!String(path).startsWith(join(dir, "t") + "/")) return open(path, flags, mode, callback);
      callback(Object.assign(new Error("no space left"), { code: "ENOSPC" }), -1);
      resolve();
    });
  });

  const outcome = adapter(dir, bin).run(request(dir));
  const settled = outcome.then(() => true, () => true);
  await failed;
  const returnedBeforeExit = await Promise.race([settled, setImmediate(false)]);
  fs.writeFileSync(join(dir, "release"), "");

  assert.equal(returnedBeforeExit, false);
  const out = await outcome;
  assert.equal(out.status, "harness_error");
  assert.match(out.error ?? "", /failed to write transcript: no space left/);
  assert.equal(out.transcriptPath, null);
  assert.equal(out.usage.reportedCostUsd, 0.001);
});

test("a missing executable fails the version pin cleanly before any slot runs", async () => {
  await assert.rejects(adapter(makeTempDir()).version(), /--version could not run: .*ENOENT/);
});
