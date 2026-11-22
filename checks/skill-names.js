import { posix } from "node:path";
import { SKILL, isA } from "./artifacts.js";
import { frontmatter } from "./frontmatter.js";

const key = (name) => name.toLowerCase();

function frontmatterName(text) {
  const name = frontmatter(text)?.get("name");
  return name?.value ? { name: name.value, line: name.line } : null;
}

function linkNames({ path, text }) {
  const folder = posix.basename(posix.dirname(path));
  const declared = frontmatterName(text) ?? { name: folder, line: 1 };
  const names = [declared, { name: folder, line: 1 }];
  return names.filter(({ name }, index) => names.findIndex((other) => key(other.name) === key(name)) === index).map((name) => ({ path, ...name }));
}

const fix = (name, other) => `skill name "${name}" is also used by ${other}. Harnesses link skills flat by name, so rename one.`;

export function check({ files }) {
  const byName = Map.groupBy(files.filter(isA(SKILL)).flatMap(linkNames), ({ name }) => key(name));
  return [...byName.values()]
    .flatMap((skills) =>
      skills.flatMap(({ path, name, line }) =>
        skills.filter((other) => other.path !== path).map((other) => ({ path, line, message: fix(name, other.path) })),
      ),
    )
    .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}
