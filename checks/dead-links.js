import { posix } from "node:path";
import { isMarkdown, proseLines } from "./markdown.js";

const INLINE = /\[(?:[^[\]]|\[[^\]]*\])*\]\(\s*(?:<([^>]+)>|((?:[^()\s]|\([^()\s]*\))+))(?:\s+[^)]*)?\)/g;
const REFERENCE = /^ {0,3}\[(?!\^)[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/g;
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|#|\/\/)/i;

function decode(target) {
  try {
    return decodeURI(target);
  } catch {
    return null;
  }
}

function resolve(from, target) {
  const path = decode(target.replace(/[?#].*$/, ""));
  if (path === null) return null;
  const joined = path.startsWith("/") ? path.slice(1) : posix.join(posix.dirname(from), path);
  return posix.normalize(joined).replace(/\/$/, "");
}

const outsideRepo = (path) => path === ".." || path.startsWith("../");
const exists = (path, contains) => path !== null && (path === "." || (!outsideRepo(path) && contains(path)));

const links = (prose) =>
  [INLINE, REFERENCE].flatMap((pattern) =>
    [...prose.matchAll(pattern)].map((match) => ({ target: match[1] ?? match[2], column: match.index + match[0].indexOf("[") + 1 })),
  );

function deadLinks({ path, text }, contains) {
  return proseLines(text).flatMap(({ line, prose }) =>
    links(prose)
      .filter(({ target }) => !EXTERNAL.test(target))
      .filter(({ target }) => !exists(resolve(path, target), contains))
      .map(({ target, column }) => ({ path, line, column, message: `dead link to \`${target}\`. Fix the path or remove the link.` })),
  );
}

export const check = ({ files, contains }) =>
  files.filter(({ path }) => isMarkdown(path)).flatMap((file) => deadLinks(file, contains));
