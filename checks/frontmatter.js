const KEY = /^([A-Za-z][\w-]*):(.*)$/;
const BLOCK = /^[>|][+-]?$/;
const QUOTED = /^(["'])(.*?)\1(?:\s+#.*)?$/;

const unquote = (value) => (QUOTED.test(value) ? value.replace(QUOTED, "$2") : value.replace(/(^|\s+)#.*$/, ""));

export function frontmatter(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const isFence = (line) => line.trimEnd() === "---";
  if (!isFence(lines[0])) return null;
  const end = lines.findIndex((line, index) => index > 0 && isFence(line));
  if (end === -1) return null;
  const fields = new Map();
  let current = null;
  lines.slice(1, end).forEach((raw, index) => {
    const match = raw.match(KEY);
    if (match) {
      const value = match[2].trim();
      const block = BLOCK.test(value.replace(/\s+#.*$/, ""));
      current = { value: block ? "" : unquote(value), line: index + 2, continues: block || (value !== "" && !QUOTED.test(value)) };
      fields.set(match[1], current);
    } else if (current?.continues && /^\s/.test(raw) && raw.trim()) {
      current.value = [current.value, raw.trim()].filter(Boolean).join(" ");
    }
  });
  return new Map([...fields].map(([key, { value, line }]) => [key, { value, line }]));
}
