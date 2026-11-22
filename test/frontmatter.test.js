import { test } from "node:test";
import assert from "node:assert/strict";
import { frontmatter } from "../checks/frontmatter.js";

const fields = (text) => Object.fromEntries([...frontmatter(text)].map(([key, { value, line }]) => [key, [value, line]]));

test("reads plain, quoted, commented and block values with their lines", () => {
  const text = ["---", "name: plain", 'title: "a # kept"', "note: value # dropped", "description: >", "  folded", "  text", "empty: # only a comment", "---", "# Body"].join("\r\n");
  assert.deepEqual(fields(text), {
    name: ["plain", 2],
    title: ["a # kept", 3],
    note: ["value", 4],
    description: ["folded text", 5],
    empty: ["", 8],
  });
});

test("joins wrapped plain values and commented block markers, but not nested keys", () => {
  const text = ["---", "description: Does one thing.", "  Use when it applies.", "summary: > # folded", "  kept", "metadata:", "  version: 1", "---"].join("\n");
  assert.deepEqual(fields(text), {
    description: ["Does one thing. Use when it applies.", 2],
    summary: ["kept", 4],
    metadata: ["", 6],
  });
});

test("reads a value on the next line and skips comment lines, but keeps # in block scalars", () => {
  const text = ["---", "description:", "  Does one thing.", "  # a note", "name: twin", "  # explanation", "empty: # TODO", "  # fill later", "body: |", "  # kept", "list:", "  - item", "---"].join("\n");
  assert.deepEqual(fields(text), {
    description: ["Does one thing.", 2],
    name: ["twin", 5],
    empty: ["", 7],
    body: ["# kept", 9],
    list: ["", 11],
  });
});

test("a byte order mark and trailing spaces on the fences are ignored", () => {
  assert.deepEqual(fields("\uFEFF--- \nname: marked\n---  \n"), { name: ["marked", 2] });
});

test("a file without a closed frontmatter block has none", () => {
  assert.equal(frontmatter("# Title\n"), null);
  assert.equal(frontmatter("---\nname: open\n"), null);
});
