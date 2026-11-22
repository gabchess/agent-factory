import { matchesByLine, textLines } from "./lines.js";
import { isMarkdown, proseLines } from "./markdown.js";

const FIX = 'Rewrite the sentence with a comma, colon, period or parentheses. Write ranges as "44 to 51".';
const DASHES = { "\u2014": "em dash", "\u2013": "en dash" };

const findings = (lines, pattern, name) =>
  matchesByLine(lines, pattern).map(({ line, column, match }) => ({ line, column, message: `${name(match)}. ${FIX}` }));

function findDashes({ path, text }) {
  const unicode = findings(textLines(text), /[\u2014\u2013]/g, (match) => DASHES[match[0]]);
  const hyphens = isMarkdown(path) ? findings(proseLines(text), /(?<=[^\s|] )-{1,2}(?= [^\s|])/g, () => "hyphen used as a dash") : [];
  return [...unicode, ...hyphens]
    .sort((a, b) => a.line - b.line || a.column - b.column)
    .map((finding) => ({ path, ...finding }));
}

export const check = ({ files }) => files.flatMap(findDashes);
