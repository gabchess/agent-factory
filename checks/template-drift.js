import { frontmatter } from "./frontmatter.js";
import { proseLines } from "./markdown.js";
import { TEMPLATED, isA } from "./artifacts.js";

const headings = (text) =>
  proseLines(text)
    .map(({ line, raw }) => ({ line, heading: raw.replace(/\r$/, "").trimEnd() }))
    .filter(({ heading }) => /^## \S/.test(heading));

function shape(text) {
  return { keys: [...(frontmatter(text) ?? new Map()).keys()], headings: headings(text) };
}

function drift({ path, text }, template, expected) {
  const actual = shape(text);
  const order = expected.headings.map(({ heading }) => heading).join(", ");
  const missingKeys = expected.keys
    .filter((key) => !actual.keys.includes(key))
    .map((key) => ({ path, line: 1, message: `missing frontmatter key "${key}" that ${template} has. Add it.` }));
  const found = expected.headings.map(({ heading }) => ({ heading, at: actual.headings.find((h) => h.heading === heading) }));
  const missingSections = found
    .filter(({ at }) => !at)
    .map(({ heading }) => ({ path, line: 1, message: `missing section "${heading}" that ${template} has. Add it so the sections run: ${order}.` }));
  const present = found.filter(({ at }) => at);
  const outOfOrder = present
    .filter(({ at }, index) => present.slice(0, index).some((earlier) => earlier.at.line > at.line))
    .map(({ heading, at }) => ({ path, line: at.line, message: `section "${heading}" is out of order. ${template} runs: ${order}.` }));
  return [...missingKeys, ...missingSections, ...outOfOrder];
}

function checkKind(kind, files) {
  const { name, template } = kind;
  const artifacts = files.filter(isA(kind));
  const source = files.find(({ path }) => path === template);
  if (!source) {
    return artifacts.map(({ path }) => ({
      path,
      line: 1,
      message: `no template at ${template} for this ${name}. Restore the template before adding ${name}s.`,
    }));
  }
  const expected = shape(source.text);
  return artifacts.flatMap((file) => drift(file, template, expected));
}

export const check = ({ files }) =>
  TEMPLATED.flatMap((kind) => checkKind(kind, files)).sort((a, b) => a.path.localeCompare(b.path));
