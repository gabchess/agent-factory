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

test("a file without a closed frontmatter block has none", () => {
  assert.equal(frontmatter("# Title\n"), null);
  assert.equal(frontmatter("---\nname: open\n"), null);
});
