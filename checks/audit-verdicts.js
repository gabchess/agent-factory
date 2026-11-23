const HEADER = "source\tpath\tverdict\treason\tticket";
const COLUMNS = HEADER.split("\t").length;
const VERDICTS = new Set(["delete", "rewrite"]);
const TICKET = /^[A-Z]+-\d+$/;

const isAuditTable = ({ path }) => path.startsWith("data/audit/") && path.endsWith(".tsv");

function rowFailure(fields, seen, line) {
  if (fields.length !== COLUMNS)
    return `The row has ${fields.length} columns, not ${COLUMNS}. Separate source, path, verdict, reason and ticket with tabs.`;
  const [source, path, verdict, reason, ticket] = fields;
  const key = `${source} ${path}`;
  if (seen.has(key)) return `${key} already has a verdict on line ${seen.get(key)}. Keep one row per file.`;
  seen.set(key, line);
  if (!VERDICTS.has(verdict))
    return `Verdict "${verdict}" is not delete or rewrite. Nothing is kept as is: delete it or file a rewrite ticket.`;
  if (!reason.trim()) return "Every verdict needs a reason. Say why the file goes or what survives.";
  if (verdict === "rewrite" && !TICKET.test(ticket)) return "A rewrite needs the key of the ticket that rewrites it, like GAB-123.";
  if (verdict === "delete" && ticket) return "A delete names no ticket. Clear the ticket column or make it a rewrite.";
  return null;
}

function tableFailures({ path, text }) {
  const [header, ...rows] = text.replace(/\n$/, "").split("\n");
  if (header !== HEADER)
    return [{ path, line: 1, message: "The header must be source, path, verdict, reason, ticket, separated by tabs." }];
  const seen = new Map();
  return rows
    .map((row, index) => ({ line: index + 2, message: rowFailure(row.split("\t"), seen, index + 2) }))
    .filter(({ message }) => message)
    .map(({ line, message }) => ({ path, line, message }));
}

export const check = ({ files }) => files.filter(isAuditTable).flatMap(tableFailures);
