import { posix } from "node:path";
import { isAgentsFile } from "./artifacts.js";
import { linkSpans, maskSpans } from "./links.js";
import { proseLines } from "./markdown.js";

const READ = /\bread\s+/gi;
const TARGET = /`([^`]+)`|([\w./-]+\.md)\b/y;
const WHEN = /^\s*(?:[-*+]\s+|\d+\.\s+)?when\b/i;
const CONTINUATION = /^\s+(?![-*+]\s|\d+\.\s)\S/;
const resolves = (folder, target, contains) =>
  [target, target.replace(/[?#].*$/, "")].some((path) => contains(posix.join(folder, path)));

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

function pointers(raw, prose) {
  const links = linkSpans(prose);
  return [...maskSpans(prose, links).matchAll(READ)].flatMap((read) => {
    const at = read.index + read[0].length;
    const column = read.index + 1;
    if (links.some(({ start }) => start === at)) return [{ column }];
    TARGET.lastIndex = at;
    const match = TARGET.exec(raw);
    return match ? [{ column, target: match[1] ?? match[2] }] : [];
  });
}

function pointerFailures({ path, text }, contains) {
  const folder = posix.dirname(path);
  return withItemStart(proseLines(text)).flatMap(({ line, raw, prose, start }) =>
    pointers(raw, prose).flatMap(({ column, target }) => [
      ...(target && !resolves(folder, target, contains) ? [{ path, line, column, message: deadPointer(target) }] : []),
      ...(WHEN.test(start) ? [] : [{ path, line, column, message: NO_CONDITION }]),
    ]),
  );
}

export const check = ({ files, contains }) =>
  files.filter(isAgentsFile).flatMap((file) => pointerFailures(file, contains));
