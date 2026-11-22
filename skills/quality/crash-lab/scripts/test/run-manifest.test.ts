import assert from "node:assert/strict";
import { test } from "node:test";
import { chmodSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { FROZEN_PATHS, codeTree, freezeManifest, runPaths } from "../src/session-execution/run-manifest.ts";
import { makeTempDir, sha256 } from "../src/util/fs.ts";

const manifest = { runId: "run-one", experimentSha256: "e", checksSha256: "c", cliVersion: "1.0.0", model: "m" };

test("run ids must be lowercase letters, digits and dashes", () => {
  assert.throws(() => runPaths(makeTempDir("results-"), "Bad_Id", "smoke"), /--run-id/);
  assert.throws(() => runPaths(makeTempDir("results-"), "", "smoke"), /--run-id/);
});

test("a phase that already holds evidence cannot be run again under the same run id", () => {
  const root = makeTempDir("results-");
  const { phaseDir, attemptsLog } = runPaths(root, "run-one", "smoke");
  mkdirSync(phaseDir, { recursive: true });
  writeFileSync(attemptsLog, "");
  assert.throws(() => runPaths(root, "run-one", "smoke"), /already has evidence/);
  assert.doesNotThrow(() => runPaths(root, "run-one", "main"));
});

test("the manifest refuses to freeze when git cannot describe the lab tree", () => {
  const notARepo = makeTempDir("lab-");
  const runDir = join(makeTempDir("results-"), "runs", "run-one");
  assert.throws(() => freezeManifest({ labRoot: notARepo, runDir, sandboxImage: "unused", manifest }), /git -C .* rev-parse HEAD failed/);
});

test("the code tree digest hashes git ls-tree output byte for byte, so manifests frozen earlier still match", () => {
  const lab = join(import.meta.dirname, "..");
  const raw = spawnSync("git", ["-C", lab, "ls-tree", "-r", "HEAD", "--", ...FROZEN_PATHS], { encoding: "utf8" }).stdout;
  assert.equal(codeTree(lab, "HEAD"), sha256(Buffer.from(raw)));
});

function committedLab(): { lab: string; commit: string } {
  const lab = makeTempDir("lab-");
  const git = (...args: string[]) => spawnSync("git", ["-C", lab, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" });
  git("init", "-q");
  writeFileSync(join(lab, "package.json"), "{}");
  git("add", ".");
  git("commit", "-qm", "init");
  return { lab, commit: git("rev-parse", "HEAD").stdout.trim() };
}

function withDocker<T>(script: string, body: (setScript: (s: string) => void) => T): T {
  const bin = makeTempDir("bin-");
  const setScript = (s: string) => {
    writeFileSync(join(bin, "docker"), `#!/bin/sh\n${s}`);
    chmodSync(join(bin, "docker"), 0o755);
  };
  setScript(script);
  const original = process.env.PATH;
  process.env.PATH = `${bin}:${original}`;
  try {
    return body(setScript);
  } finally {
    process.env.PATH = original;
  }
}

test("a fresh run id publishes a complete manifest and leaves no draft behind", () => {
  const { lab, commit } = committedLab();
  const runDir = join(makeTempDir("results-"), "runs", "run-one");
  const frozen = withDocker("echo sha256:img\n", () => freezeManifest({ labRoot: lab, runDir, sandboxImage: "img", manifest }));
  assert.deepEqual(JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8")), frozen);
  assert.equal(frozen.gitCommit, commit);
  assert.equal(frozen.sandboxImageId, "sha256:img");
  assert.deepEqual(readdirSync(runDir), ["manifest.json"]);
});

test("a starter that loses the race to freeze a run id adopts the winner's manifest instead of overwriting it", () => {
  const { lab, commit } = committedLab();
  const winner = { ...manifest, gitCommit: commit, codeTree: codeTree(lab, "HEAD"), sandboxImageId: "sha256:img", createdAt: "winner" };
  const runDir = join(makeTempDir("results-"), "runs", "run-one");
  const path = join(runDir, "manifest.json");
  withDocker(`mkdir -p '${runDir}' && cat > '${path}' <<'EOF'\n${JSON.stringify(winner)}\nEOF\necho sha256:img\n`, (setScript) => {
    assert.equal(freezeManifest({ labRoot: lab, runDir, sandboxImage: "img", manifest }).createdAt, "winner");
    setScript("echo sha256:other\n");
    assert.throws(() => freezeManifest({ labRoot: lab, runDir, sandboxImage: "img", manifest }), /froze sandboxImageId=sha256:img, now sha256:other/);
  });
  assert.equal(JSON.parse(readFileSync(path, "utf8")).createdAt, "winner");
  assert.deepEqual(readdirSync(runDir), ["manifest.json"]);
});
