import { posix } from "node:path";
import { proseLines } from "./markdown.js";

const POINTER = /\bread\s+(?:`([^`]+)`|\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])|([\w./-]+\.md)\b)/gi;
const WHEN = /^\s*(?:[-*+]\s+|\d+\.\s+)?when\b/i;
const CONTINUATION = /^\s+(?![-*+]\s|\d+\.\s)\S/;
const resolves = (folder, target, contains) =>
  [target, target.replace(/[?#].*$/, "")].some((path) => contains(posix.join(folder, path)));
const inCode = (match, prose) => prose.slice(match.index, match.index + 4).toLowerCase() !== "read";
const isAgentsFile = (path) => posix.basename(path) === "AGENTS.md";

const deadPointer = (path) =>
  `pointer to \`${path}\`, which does not exist. Fix the path, relative to this AGENTS.md, or remove the pointer.`;
const NO_CONDITION = 'pointer without a condition. Start the line with when to read it: "When you X, read Y".';

function withItemStart(lines) {
  let start = "";
  return lines.map((entry) => {
    start = CONTINUATION.test(entry.raw) && start ? start : entry.raw;
    return { ...entry, start };
  });
}

function pointerFailures({ path, text }, contains) {
  const folder = posix.dirname(path);
  return withItemStart(proseLines(text)).flatMap(({ line, raw, prose, start }) =>
    [...raw.matchAll(POINTER)].filter((match) => !inCode(match, prose)).flatMap((match) => {
      const column = match.index + 1;
      const target = match[1] ?? match[2];
      return [
        ...(target && !resolves(folder, target, contains) ? [{ path, line, column, message: deadPointer(target) }] : []),
        ...(WHEN.test(start) ? [] : [{ path, line, column, message: NO_CONDITION }]),
      ];
    }),
  );
}

export const check = ({ files, contains }) =>
  files.filter(({ path }) => isAgentsFile(path)).flatMap((file) => pointerFailures(file, contains));
