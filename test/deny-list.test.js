import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check } from "../checks/deny-list.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const list = read("../templates/deny-list/list.json");
const claudeCode = read("../templates/deny-list/claude-code.json");
const settings = (kind) => read(`./fixtures/deny-list/${kind}/settings.json`);
const HOME = String.raw`C:\Users\test`;
const FIX = "Add it to permissions.deny in that settings.json, from templates/deny-list/claude-code.json.";

test("settings holding every rule pass, with home paths written as ~/ or absolute", () => {
  assert.deepEqual(check(settings("pass"), list, claudeCode, HOME), []);
  const tilde = { permissions: { deny: Object.values(claudeCode).flat() } };
  assert.deepEqual(check(tilde, list, claudeCode, HOME), []);
});

test("each missing rule fails with its entry and the fix", () => {
  assert.deepEqual(check(settings("fail"), list, claudeCode, HOME), [
    `missing deny rule "Read(~/.ssh/**)" (entry "read-secret-files"). ${FIX}`,
    `missing deny rule "mcp__claude_ai_Gmail__send_message" (entry "message-customers"). ${FIX}`,
  ]);
});

test("a home path under another user's folder does not count", () => {
  assert.equal(check(settings("pass"), list, claudeCode, String.raw`C:\Users\other`).length, 3);
});

test("settings with no permissions fail on every rule", () => {
  assert.equal(check({}, list, claudeCode, HOME).length, Object.values(claudeCode).flat().length);
});

test("an entry with no Claude Code mapping fails", () => {
  assert.deepEqual(check(settings("pass"), [{ id: "new-entry" }], claudeCode, HOME), [
    'entry "new-entry" has no Claude Code mapping. Add "new-entry" to templates/deny-list/claude-code.json, with [] when no rule can express it.',
  ]);
});

test("every list entry names a safety floor line in AGENTS.md, and every mapping key is a list entry", () => {
  const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
  const floor = agents.split("## Safety floor")[1].split("\n## ")[0].split(/\r?\n/).filter((line) => line.startsWith("- "));
  for (const { id, floor: quote } of list) assert.ok(floor.some((line) => line.startsWith(`- ${quote}`)), `${id}: "${quote}" is not a safety floor line`);
  assert.deepEqual(Object.keys(claudeCode).sort(), list.map(({ id }) => id).sort());
});
