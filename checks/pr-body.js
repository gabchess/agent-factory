import MarkdownIt from "markdown-it";

const COMMIT = "e484a8095543718ced436b9b49a8160ed4554000";
export const SKILL_URL = `https://github.com/mattpocock/skills/blob/${COMMIT}/skills/engineering/pr/SKILL.md`;

// The template in that skill: its sections in order, and the fields each asks to fill.
// test/pr-body.test.js reads the same list from the copy in test/fixtures/pr-body/skill/ and fails when the two drift apart.
export const TEMPLATE = [
  { heading: "Summary", fields: [{ placeholder: "<diagram, diff-sketch, or tree>" }] },
  {
    heading: "Evidence",
    fields: [
      { label: "Before", placeholder: "<screenshot/output/failing test run>" },
      { label: "After", placeholder: "<screenshot/output/passing test run>" },
    ],
  },
  {
    heading: "Merge Danger",
    fields: [
      { label: "Door", placeholder: "<one-way or two-way>" },
      { placeholder: "<optional: description>" },
      { label: "Blast Radius", placeholder: "<one-word description>" },
      { placeholder: "<optional: potential ramifications of merge>" },
    ],
  },
];

// GitHub renders a PR body with cmark-gfm. markdown-it follows the same CommonMark spec, so with raw HTML on
// it finds code blocks, HTML blocks, comments, inline code and headings where GitHub does.
const markdown = new MarkdownIt({ html: true });
const COMMENT = /<!--(?:-?>|[^]*?(?:-->|$))/g;
const WORD = /[\p{L}\p{N}]/u;
// A tag name ends at a space, a slash or ">", so <title-bar> is no <title> and <img-x> is no <img>.
const IMAGE = /^<(?:img|video)(?=[\s/>])/i;
const PLACEHOLDERS = TEMPLATE.flatMap(({ fields }) => fields.map(({ placeholder }) => placeholder));
const CODE = new Set(["fence", "code_block"]);

const PIN = `the sections and labels above are the pr skill's template at mattpocock/skills ${COMMIT.slice(0, 7)} (${SKILL_URL}). If your pr skill writes other ones, it is newer than this pin: write the body to this template, or move the pin as checks/README.md says.`;
const ORDER = `the sections are out of order. Put them in the template's order: ${TEMPLATE.map(({ heading }) => `"## ${heading}"`).join(", ")}.`;

// The body as GitHub shows it: one piece per block token or inline token, in order, each with the depth of its block.
const pieces = (body) =>
  markdown.parse(body, {}).flatMap((token) =>
    token.type === "inline"
      ? token.children.map(({ type, content }) => ({ type, content, depth: token.level, inline: true }))
      : [{ type: token.type, tag: token.tag, nesting: token.nesting, content: token.content, depth: token.level }],
  );

// The text a reader sees in one piece. GitHub hides comments and shows no tag or attribute of raw HTML.
// <br> and a block tag, such as <p>, <li> or <summary>, end the line; every other tag vanishes, as <b> or <wbr> does,
// except the tags GitHub's tag filter shows as text, such as <textarea>.
const SHOWN_TAG = /^<\/?(?:iframe|noembed|noframes|plaintext|script|style|textarea|title|xmp)(?=[\s/>])/i;
const BREAK_TAG = /^<\/?(?:address|article|aside|blockquote|br|dd|details|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul)(?=[\s/>])/i;
// A whole tag, with a ">" inside a quoted attribute value kept inside the tag.
const TAG = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const shown = ({ type, content }) =>
  type === "text" || type === "code_inline" || type === "image" || CODE.has(type)
    ? content
    : type.startsWith("html")
      ? content.replace(COMMENT, "").replace(TAG, (tag) => (SHOWN_TAG.test(tag) ? tag : BREAK_TAG.test(tag) ? "\n" : ""))
      : type === "softbreak" || type === "hardbreak" ? "\n" : "";
// The text a reader sees in a run of pieces: inline pieces run together as they render, and each block stands on its own lines.
const visible = (pieces) => pieces.map((piece) => (piece.inline ? shown(piece) : `\n${shown(piece)}\n`)).join("");
// That text with the template's placeholders taken out, in code or not.
const unplaced = (pieces) => PLACEHOLDERS.reduce((rest, placeholder) => rest.replaceAll(placeholder, ""), visible(pieces));

// Splits the pieces at each top-level "# " or "## " heading. A "## " section is named by its text in lower case.
function sections(all) {
  const found = [{ name: null, pieces: [] }];
  for (let i = 0; i < all.length; i++) {
    const { type, tag, depth } = all[i];
    if (type !== "heading_open" || depth !== 0 || (tag !== "h1" && tag !== "h2")) {
      found.at(-1).pieces.push(all[i]);
      continue;
    }
    const end = all.findIndex((piece, j) => j > i && piece.type === "heading_close");
    const name = all.slice(i + 1, end).filter(({ type }) => type === "text" || type === "code_inline").map(({ content }) => content).join("");
    found.push({ name: tag === "h2" ? name.trim().toLowerCase() : null, pieces: [] });
    i = end;
  }
  return found;
}

const labelAt = (section, i) =>
  section[i].type === "strong_open" && section[i + 1]?.type === "text" && section[i + 2]?.type === "strong_close" ? section[i + 1].content.trim().toLowerCase() : undefined;

// What follows each "**<label>:**": the rest of its paragraph, then the blocks after it, up to the section's next label
// or the end of the list item or quote that holds it.
function scopes(section, label, labels) {
  const found = [];
  for (let i = 0; i < section.length; i++) {
    if (labelAt(section, i) !== label) continue;
    const scope = [];
    for (let j = i + 3; j < section.length && !labels.includes(labelAt(section, j)); j++) {
      if (section[j].nesting === -1 && section[j].depth < section[i].depth - 1) break;
      scope.push(section[j]);
    }
    found.push(scope);
  }
  return found;
}

const visual = (scope) =>
  scope.some((piece) => (CODE.has(piece.type) && unplaced([piece]).trim()) || piece.type === "image" || (piece.type.startsWith("html") && (piece.content.replace(COMMENT, "").match(TAG) ?? []).some((tag) => IMAGE.test(tag))));
const filled = (scope) => WORD.test(unplaced(scope)) || visual(scope);

function field(section, labels, heading, { label, placeholder }) {
  if (!label) return visual(section) ? [] : [`"## ${heading}" holds no code block or image in place of "${placeholder}". Add one.`];
  const found = scopes(section, `${label}:`.toLowerCase(), labels);
  if (!found.length) return [`"## ${heading}" lacks "**${label}:**". Add it with "${placeholder}" filled in.`];
  if (!found.every(filled)) return [`"**${label}:**" under "## ${heading}" holds nothing but "${placeholder}", a comment or markup. Write it after the label, before the next label or the end of its list item.`];
  // A placeholder that offers choices, as "<one-way or two-way>" does, needs one of them.
  const choices = /^<(\S+) or (\S+)>$/.exec(placeholder)?.slice(1);
  const says = (scope) => choices.some((choice) => new RegExp(`(?<![\\p{L}-])${choice}(?![\\p{L}-])`, "iu").test(unplaced(scope)));
  if (choices && !found.every(says)) return [`"**${label}:**" under "## ${heading}" does not say ${choices.map((choice) => `"${choice}"`).join(" or ")}. Write one of them.`];
  return [];
}

function template(all) {
  const found = TEMPLATE.map(({ heading }) => all.findIndex(({ name }) => name === heading.toLowerCase()));
  const present = found.filter((index) => index !== -1);
  const failures = [
    ...TEMPLATE.filter((_, i) => found[i] === -1).map(({ heading }) => `the body has no "## ${heading}" section. Add it as the pr skill's template writes it.`),
    ...(present.some((index, i) => index < present[i - 1]) ? [ORDER] : []),
    ...TEMPLATE.flatMap(({ heading, fields }, i) => {
      if (found[i] === -1) return [];
      const labels = fields.filter(({ label }) => label).map(({ label }) => `${label}:`.toLowerCase());
      return fields.filter(({ placeholder }) => !placeholder.startsWith("<optional:")).flatMap((each) => field(all[found[i]].pieces, labels, heading, each));
    }),
  ];
  return failures.length ? [...failures, PIN] : [];
}

// A line of a code block runs the command when it is the command exactly, after a "$ " prompt or alone, or when it is
// the command, then a tab or two spaces, then its output. What follows a typed command is an argument, never output.
const typed = (line, command) => {
  const prompted = /^\s*\$\s+(.*)$/.exec(line);
  if (prompted) return prompted[1].trim() === command ? "" : undefined;
  const rest = line.trim();
  return rest === command ? "" : rest.startsWith(command) && /^(?:\t| {2})\s*\S/.test(rest.slice(command.length)) ? rest.slice(command.length) : undefined;
};

// "output" when a code block quotes the command with output on its line or on the next line that is not another command.
function quoted(blocks, command, commands) {
  let state = "missing";
  for (const lines of blocks) {
    for (const [i, line] of lines.entries()) {
      const rest = typed(line, command);
      if (rest === undefined) continue;
      const next = lines.slice(i + 1).find((after) => after.trim());
      if (rest.trim() || (next !== undefined && !/^\s*\$\s/.test(next) && commands.every((other) => typed(next, other) === undefined))) return "output";
      state = "bare";
    }
  }
  return state;
}

function output(all, { head, commands }) {
  const blocks = all.filter(({ type }) => CODE.has(type)).map(({ content }) => content.split("\n"));
  const hex = visible(all).toLowerCase().split(/[^0-9a-f]+/);
  return [
    head && !hex.includes(head.toLowerCase()) && `the body does not name the head ${head}. Run the checks at the head and quote their last lines with its SHA, as ADR 0006 asks.`,
    ...commands.map((command) => {
      const state = quoted(blocks, command, commands);
      if (state === "missing") return `no code block quotes "${command}". Run it at the head and quote it with the last lines it printed.`;
      return state === "bare" && `"${command}" has no output after it in its code block. Add the last lines it printed.`;
    }),
  ].filter(Boolean);
}

export function check(body, { head, commands = [] } = {}) {
  const all = pieces(body);
  return [...output(all, { head, commands }), ...template(sections(all))];
}
