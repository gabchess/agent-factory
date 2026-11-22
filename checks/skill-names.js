import { posix } from "node:path";

const isSkill = (path) => path.startsWith("skills/") && posix.basename(path) === "SKILL.md";

function frontmatterName(text) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  const index = lines.slice(1, end).findIndex((line) => /^name:\s*\S/.test(line));
  return index === -1 ? null : { name: lines[index + 1].replace(/^name:\s*/, "").trim(), line: index + 2 };
}

function linkNames({ path, text }) {
  const folder = posix.basename(posix.dirname(path));
  const declared = frontmatterName(text) ?? { name: folder, line: 1 };
  const names = [declared, { name: folder, line: 1 }];
  return names.filter(({ name }, index) => names.findIndex((other) => other.name === name) === index).map((name) => ({ path, ...name }));
}

const fix = (name, other) => `skill name "${name}" is also used by ${other}. Harnesses link skills flat by name, so rename one.`;

export function check({ files }) {
  const byName = Map.groupBy(files.filter(({ path }) => isSkill(path)).flatMap(linkNames), ({ name }) => name);
  return [...byName.values()]
    .flatMap((skills) =>
      skills.flatMap(({ path, name, line }) =>
        skills.filter((other) => other.path !== path).map((other) => ({ path, line, message: fix(name, other.path) })),
      ),
    )
    .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}
