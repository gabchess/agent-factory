const KEY = /^([A-Za-z][\w-]*):(.*)$/;
const BLOCK = /^[>|][+-]?$/;
const QUOTED = /^(["'])(.*?)\1(?:\s+#.*)?$/;

const unquote = (value) => (QUOTED.test(value) ? value.replace(QUOTED, "$2") : value.replace(/(^|\s+)#.*$/, ""));

export function frontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  const fields = new Map();
  let current = null;
  lines.slice(1, end).forEach((raw, index) => {
    const match = raw.match(KEY);
    if (match) {
      const value = match[2].trim();
      current = { value: BLOCK.test(value) ? "" : unquote(value), line: index + 2, block: BLOCK.test(value) };
      fields.set(match[1], current);
    } else if (current?.block && raw.trim()) {
      current.value = [current.value, raw.trim()].filter(Boolean).join(" ");
    }
  });
  return new Map([...fields].map(([key, { value, line }]) => [key, { value, line }]));
}
