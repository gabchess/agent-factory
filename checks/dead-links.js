import { posix } from "node:path";
import { isMarkdown, proseLines } from "./markdown.js";

const INLINE = /\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+[^)]*)?\)/g;
const REFERENCE = /^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/g;
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|#)/i;

function resolve(from, target) {
  const path = decodeURI(target.replace(/[?#].*$/, ""));
  const joined = path.startsWith("/") ? path.slice(1) : posix.join(posix.dirname(from), path);
  return posix.normalize(joined).replace(/\/$/, "");
}

const links = (prose) =>
  [INLINE, REFERENCE].flatMap((pattern) =>
    [...prose.matchAll(pattern)].map((match) => ({ target: match[1], column: match.index + match[0].indexOf("[") + 1 })),
  );

function deadLinks({ path, text }, contains) {
  return proseLines(text).flatMap(({ line, prose }) =>
    links(prose)
      .filter(({ target }) => !EXTERNAL.test(target))
      .filter(({ target }) => {
        const resolved = resolve(path, target);
        return resolved !== "." && ((resolved === ".." || resolved.startsWith("../")) || !contains(resolved));
      })
      .map(({ target, column }) => ({ path, line, column, message: `dead link to \`${target}\`. Fix the path or remove the link.` })),
  );
}

export const check = ({ files, contains }) =>
  files.filter(({ path }) => isMarkdown(path)).flatMap((file) => deadLinks(file, contains));
