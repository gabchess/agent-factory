const FENCE = /^\s*(`{3,}|~{3,})/;
const HEADING = /^##\s+(.+?)\s*#*\s*$/;
const SHA = /\b[0-9a-f]{40}\b/g;
const SECTIONS = [
  ["Summary", "with a diagram, diff sketch or tree in a fenced code block"],
  ["Evidence", "with **Before:** and **After:**"],
  ["Merge danger", "with **Door:** and **Blast radius:**"],
];

const OPEN = 'the body does not open with the checks\' output. Start it with one fenced code block, before "## Summary", that names the head SHA and holds each check command as "$ <command>" with the last lines it printed.';
const NO_SHA = 'the checks\' output names no head SHA. Add the 40 character SHA that "git rev-parse HEAD" prints to the opening code block.';
const NO_COMMANDS = 'the checks\' output holds no command. Write each check command as "$ <command>", with the last lines it printed under it.';
const ORDER = 'the sections are out of order. Put them in the pr skill\'s order: "## Summary", "## Evidence", "## Merge danger".';

// Each section holds the prose lines and the fenced code blocks under one "## " heading; the first holds what comes before any heading.
function sections(lines) {
  const all = [{ name: null, prose: [], code: [] }];
  let fence = null;
  for (const line of lines) {
    const marker = line.match(FENCE)?.[1];
    const section = all.at(-1);
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      else section.code.at(-1).push(line);
    } else if (marker) {
      fence = marker;
      section.code.push([]);
    } else if (HEADING.test(line)) {
      all.push({ name: HEADING.exec(line)[1].toLowerCase(), prose: [], code: [] });
    } else {
      section.prose.push(line);
    }
  }
  return all;
}

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
  const shas = [...new Set(block.join("\n").match(SHA) ?? [])];
  const ran = commandsRun(block);
  return [
    !shas.length && NO_SHA,
    shas.length && head && !shas.includes(head) && `the checks' output is for ${shas[0]}, not the head ${head}. Run the checks again at the head and replace the opening code block.`,
    !commands.length && ![...ran.values()].includes(true) && NO_COMMANDS,
    ...commands.map((command) =>
      !ran.has(command)
        ? `the checks' output lacks "$ ${command}". Run it at the head and add the command and the last lines it printed to the opening code block.`
        : !ran.get(command) && `"$ ${command}" has no output under it. Add the last lines it printed.`,
    ),
  ].filter(Boolean);
}

function skillSections(all) {
  const found = SECTIONS.map(([name]) => all.findIndex((section) => section.name === name.toLowerCase()));
  const present = found.filter((index) => index !== -1);
  const [summary, evidence, danger] = found.map((index) => all[index]);
  const prose = (section) => section.prose.join("\n");
  return [
    ...SECTIONS.map(([name, what], i) => found[i] === -1 && `the body has no "## ${name}" section. Add it ${what}, as the pr skill's template shows.`),
    present.some((index, i) => index < present[i - 1]) && ORDER,
    summary && !summary.code.length && '"## Summary" holds no diagram, diff sketch or tree. Add one in a fenced code block.',
    evidence && !/\*\*Before:\*\*/i.test(prose(evidence)) && '"## Evidence" lacks "**Before:**". Show the failing run or the output before the change.',
    evidence && !/\*\*After:\*\*/i.test(prose(evidence)) && '"## Evidence" lacks "**After:**". Show the passing run or the output after the change.',
    danger && !/\*\*Door:\*\*\s*(one|two)-way\b/i.test(prose(danger)) && '"## Merge danger" lacks "**Door:** one-way" or "**Door:** two-way". Say whether a revert can walk the merge back.',
    danger && !/\*\*Blast radius:\*\*[ \t]*\S/i.test(prose(danger)) && '"## Merge danger" lacks "**Blast radius:**" with a word after it. Name what the merge can affect.',
  ].filter(Boolean);
}

export function check(body, { head, commands = [] } = {}) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const all = sections(lines);
  const opens = FENCE.test(lines.find((line) => line.trim()) ?? "");
  return [...checksOutput(opens ? all[0].code[0] : undefined, { head, commands }), ...skillSections(all)];
}
