const KEY = /^([A-Za-z][\w-]*):(.*)$/;
const BLOCK = /^[>|][+-]?$/;
const QUOTED = /^(["'])(.*?)\1(?:\s+#.*)?$/;
const NESTED = /^\s+(?:[\w-]+:(?:\s|$)|-\s)/;

const stripComment = (value) => value.replace(/(^|\s+)#.*$/, "");
const unquote = (value) => (QUOTED.test(value) ? value.replace(QUOTED, "$2") : stripComment(value));
const isFence = (line) => line.trimEnd() === "---";

function block(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (!isFence(lines[0])) return null;
  const end = lines.findIndex((line, index) => index > 0 && isFence(line));
  return end === -1 ? null : { lines: lines.slice(1, end), end: end + 1 };
}

export const frontmatterEnd = (text) => block(text)?.end ?? 0;

function continueValue(field, raw) {
  if (!/^\s/.test(raw) || !raw.trim()) return;
  if (field.plain && field.value === "" && NESTED.test(raw)) field.plain = false;
  const text = field.block ? raw.trim() : field.plain ? unquote(raw.trim()) : "";
  if (text) field.value = [field.value, text].filter(Boolean).join(" ");
}

export function frontmatter(text) {
  const found = block(text);
  if (!found) return null;
  const fields = new Map();
  let current = null;
  found.lines.forEach((raw, index) => {
    const match = raw.match(KEY);
    if (!match) return current && continueValue(current, raw);
    const value = match[2].trim();
    const isBlock = BLOCK.test(stripComment(value));
    current = { value: isBlock ? "" : unquote(value), line: index + 2, block: isBlock, plain: !isBlock && !QUOTED.test(value) };
    fields.set(match[1], current);
  });
  return new Map([...fields].map(([key, { value, line }]) => [key, { value, line }]));
}
