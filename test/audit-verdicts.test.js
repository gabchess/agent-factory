import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../checks/audit-verdicts.js";
import { fixture } from "./fixture.js";
import { createRepo } from "../checks/repo.js";

const file = "data/audit/old-sources.tsv";

test("a verdict table with a reason per row and a ticket per rewrite passes", () => {
  assert.deepEqual(check(fixture("audit-verdicts", "pass")), []);
});

test("a wrong header, an unknown verdict, a missing ticket or reason and a repeated file fail with the fix", () => {
  assert.deepEqual(check(fixture("audit-verdicts", "fail")), [
    {
      path: "data/audit/bad-header.tsv",
      line: 1,
      message: "The header must be source, path, verdict, reason, ticket, separated by tabs.",
    },
    { path: file, line: 2, message: 'Verdict "keep" is not delete or rewrite. Nothing is kept as is: delete it or file a rewrite ticket.' },
    { path: file, line: 3, message: "A rewrite needs the key of the ticket that rewrites it, like GAB-123." },
    { path: file, line: 4, message: "A delete names no ticket. Clear the ticket column or make it a rewrite." },
    { path: file, line: 5, message: "Every verdict needs a reason. Say why the file goes or what survives." },
    { path: file, line: 6, message: "old-repo a.md already has a verdict on line 2. Keep one row per file." },
    { path: file, line: 7, message: "The row has 3 columns, not 5. Separate source, path, verdict, reason and ticket with tabs." },
    { path: file, line: 8, message: "Every row names its source and the file or ticket it judges." },
  ]);
});

test("a verdict table checked out with CRLF line endings passes", () => {
  const text = "source\tpath\tverdict\treason\tticket\r\nold-repo\tREADME.md\tdelete\tRetired.\t\r\n";
  assert.deepEqual(check(createRepo([file], () => text)), []);
});
