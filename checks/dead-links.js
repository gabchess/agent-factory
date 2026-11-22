import { posix } from "node:path";
import { isMarkdown, proseLines } from "./markdown.js";

const INLINE = /\[(?<label>(?:[^[\]]|\[[^\]]*\])*)\]\(\s*(?:<(?<angle>[^>]+)>|(?<bare>(?:[^()\s]|\([^()\s]*\))+))(?:\s+[^)]*)?\)/dg;
const REFERENCE = /^ {0,3}\[(?!\^)[^\]]+\]:\s*(?:<(?<angle>[^>]+)>|(?<bare>\S+))/dg;
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|#|\/\/)/i;

function decode(target) {
  try {
    const segments = target.split("/").map(decodeURIComponent);
    return segments.some((segment) => segment.includes("/")) ? null : segments.join("/");
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

function link(match, raw, offset) {
  const group = match.groups.angle === undefined ? "bare" : "angle";
  const [start, end] = match.indices.groups[group];
  const target = match.groups[group];
  return { target, column: offset + match.index + match[0].indexOf("[") + 1, inCode: raw.slice(offset + start, offset + end) !== target };
}

function links(prose, raw, offset = 0) {
  const inline = [...prose.matchAll(INLINE)].flatMap((match) => [
    link(match, raw, offset),
    ...links(match.groups.label, raw, offset + match.indices.groups.label[0]),
  ]);
  const references = offset ? [] : [...prose.matchAll(REFERENCE)].map((match) => link(match, raw, offset));
  return [...inline, ...references];
}

function deadLinks({ path, text }, contains) {
  return proseLines(text).flatMap(({ line, raw, prose }) =>
    links(prose, raw)
      .filter(({ inCode }) => !inCode)
      .filter(({ target }) => !EXTERNAL.test(target))
      .filter(({ target }) => !exists(resolve(path, target), contains))
      .map(({ target, column }) => ({ path, line, column, message: `dead link to \`${target}\`. Fix the path or remove the link.` })),
  );
}

export const check = ({ files, contains }) =>
  files.filter(({ path }) => isMarkdown(path)).flatMap((file) => deadLinks(file, contains));
