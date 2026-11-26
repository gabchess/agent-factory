const FENCE = /^\s*(`{3,}|~{3,})/;
const HEADING = /^##\s+(.+?)\s*#*\s*$/;
const HEAD_COMMAND = "git rev-parse HEAD";
const LABEL = /\*\*(before|after):\*\*/i;
const SECTIONS = [
  ["Summary", "with a diagram, diff sketch or tree in a fenced code block"],
  ["Evidence", "with **Before:** and **After:**"],
  ["Merge danger", "with **Door:** and **Blast radius:**"],
];

const OPEN = 'the body does not open with the checks\' output. Start it with one fenced code block, before "## Summary", that holds "$ git rev-parse HEAD" with the SHA it printed, then each check command as "$ <command>" with the last lines it printed.';
const NO_HEAD = 'the checks\' output does not say which commit it ran on. Add "$ git rev-parse HEAD" and the SHA it printed to the opening code block.';
const NO_COMMANDS = 'the checks\' output holds no check command. Write each one as "$ <command>", with the last lines it printed under it.';
const ORDER = 'the sections are out of order. Put them in the pr skill\'s order: "## Summary", "## Evidence", "## Merge danger".';

// Drops HTML comments, which GitHub does not show, from one line outside a code block. Returns the visible text and whether a comment is still open.
function uncomment(line, open) {
  let visible = "";
  let rest = line;
  while (rest) {
    const marker = open ? rest.indexOf("-->") : rest.indexOf("<!--");
    if (marker === -1) {
      if (!open) visible += rest;
      break;
    }
    if (!open) visible += rest.slice(0, marker);
    rest = rest.slice(marker + (open ? 3 : 4));
    open = !open;
  }
  return { visible, open };
}

// Each section holds, in order, the prose lines and fenced code blocks under one "## " heading; the first holds what comes before any heading.
function sections(lines) {
  const all = [{ name: null, items: [] }];
  let fence = null;
  let comment = false;
  for (const raw of lines) {
    const section = all.at(-1);
    if (fence) {
      const marker = raw.match(FENCE)?.[1];
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      else section.items.at(-1).lines.push(raw);
      continue;
    }
    const { visible: line, open } = uncomment(raw, comment);
    comment = open;
    const marker = line.match(FENCE)?.[1];
    if (marker) {
      fence = marker;
      section.items.push({ code: true, lines: [] });
    } else if (HEADING.test(line)) {
      all.push({ name: HEADING.exec(line)[1].toLowerCase(), items: [] });
    } else if (line.trim()) {
      section.items.push({ code: false, lines: [line] });
    }
  }
  return all;
}

const hasText = (item) => item.lines.some((line) => line.replace(/^[\s>*+-]+/, "").trim());

// Maps each "$ <command>" line to whether a line of output follows it before the next command.
function commandsRun(block) {
  const ran = new Map();
  block.forEach((line, index) => {
    const command = /^\$ (.+)$/.exec(line.trim())?.[1].trim();
    if (command === undefined) return;
    const next = block.slice(index + 1).find((after) => after.trim());
    ran.set(command, ran.get(command) || (next !== undefined && !next.trim().startsWith("$ ")));
  });
  return ran;
}

function checksOutput(block, { head, commands }) {
  if (!block) return [OPEN];
  const at = block.findIndex((line) => line.trim() === `$ ${HEAD_COMMAND}`);
  const ranOn = at === -1 ? undefined : /^[0-9a-f]{40}$/.exec(block.slice(at + 1).find((line) => line.trim())?.trim() ?? "")?.[0];
  const ran = commandsRun(block);
  ran.delete(HEAD_COMMAND);
  return [
    !ranOn && NO_HEAD,
    ranOn && head && ranOn !== head && `the checks' output ran on ${ranOn}, not the head ${head}. Run the checks again at the head and replace the opening code block.`,
    !commands.length && ![...ran.values()].includes(true) && NO_COMMANDS,
    ...commands.map((command) =>
      !ran.has(command)
        ? `the checks' output lacks "$ ${command}". Run it at the head and add the command and the last lines it printed to the opening code block.`
        : !ran.get(command) && `"$ ${command}" has no output under it. Add the last lines it printed.`,
    ),
  ].filter(Boolean);
}

// True when a prose line holds the label and text or a code block follows it before the next label.
function labelled(section, label) {
  const start = section.items.findIndex((item) => !item.code && new RegExp(`\\*\\*${label}:\\*\\*`, "i").test(item.lines[0]));
  if (start === -1) return false;
  const after = section.items[start].lines[0].split(new RegExp(`\\*\\*${label}:\\*\\*`, "i"))[1];
  const sameLine = after.split(LABEL)[0];
  if (sameLine.trim()) return true;
  if (LABEL.test(after)) return false;
  for (const item of section.items.slice(start + 1)) {
    if (!item.code && LABEL.test(item.lines[0])) return Boolean(item.lines[0].split(LABEL)[0].replace(/^[\s>*+-]+/, "").trim());
    if (hasText(item)) return true;
  }
  return false;
}

function skillSections(all) {
  const found = SECTIONS.map(([name]) => all.findIndex((section) => section.name === name.toLowerCase()));
  const present = found.filter((index) => index !== -1);
  const [summary, evidence, danger] = found.map((index) => all[index]);
  const prose = (section) => section.items.filter((item) => !item.code).map((item) => item.lines[0]).join("\n");
  return [
    ...SECTIONS.map(([name, what], i) => found[i] === -1 && `the body has no "## ${name}" section. Add it ${what}, as the pr skill's template shows.`),
    present.some((index, i) => index < present[i - 1]) && ORDER,
    summary && !summary.items.some((item) => item.code && hasText(item)) && '"## Summary" holds no diagram, diff sketch or tree. Add one in a fenced code block.',
    evidence && !labelled(evidence, "Before") && '"## Evidence" lacks "**Before:**" with something after it. Show the failing run or the output before the change.',
    evidence && !labelled(evidence, "After") && '"## Evidence" lacks "**After:**" with something after it. Show the passing run or the output after the change.',
    danger && !/\*\*Door:\*\*\s*(one|two)-way\b/i.test(prose(danger)) && '"## Merge danger" lacks "**Door:** one-way" or "**Door:** two-way". Say whether a revert can walk the merge back.',
    danger && !/\*\*Blast radius:\*\*[ \t]*\S/i.test(prose(danger)) && '"## Merge danger" lacks "**Blast radius:**" with a word after it. Name what the merge can affect.',
  ].filter(Boolean);
}

export function check(body, { head, commands = [] } = {}) {
  const all = sections(body.replace(/\r\n/g, "\n").split("\n"));
  const first = all[0].items[0];
  return [...checksOutput(first?.code ? first.lines : undefined, { head, commands }), ...skillSections(all)];
}
