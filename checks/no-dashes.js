import { isMarkdown, proseLines } from "./markdown.js";

const FIX = 'Rewrite the sentence with a comma, colon, period or parentheses. Write ranges as "44 to 51".';
const DASHES = { "\u2014": "em dash", "\u2013": "en dash" };

const findings = (lines, pattern, name) =>
  lines.flatMap(({ line, prose }) =>
    [...prose.matchAll(pattern)].map((match) => ({ line, column: match.index + 1, message: `${name(match)}. ${FIX}` })),
  );

function findDashes({ path, text }) {
  const lines = text.split("\n").map((prose, index) => ({ line: index + 1, prose }));
  const unicode = findings(lines, /[\u2014\u2013]/g, (match) => DASHES[match[0]]);
  const hyphens = isMarkdown(path) ? findings(proseLines(text), /(?<=\S )-{1,2}(?= \S)/g, () => "hyphen used as a dash") : [];
  return [...unicode, ...hyphens]
    .sort((a, b) => a.line - b.line || a.column - b.column)
    .map((finding) => ({ path, ...finding }));
}

export const check = ({ files }) => files.flatMap(findDashes);
