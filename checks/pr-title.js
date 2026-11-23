export const TYPES = ["build", "chore", "ci", "docs", "feat", "fix", "perf", "refactor", "revert", "style", "test"];

const HEADER = /^(?<type>[A-Za-z]+)(?:\((?<scope>[^()]*)\))?!?: (?<description>.*)$/;
const FORMAT = 'Write it as "<type>[(scope)][!]: <description>", for example "fix(checks): skip binary files".';
const SCOPE = 'Write the scope as one lower case noun, such as "checks" or "templates", or leave it out.';
const DESCRIPTION = 'Put exactly one space after ": ", then the change in the imperative.';

export function check(title) {
  const header = HEADER.exec(title);
  if (!header) return [FORMAT];
  const { type, scope, description } = header.groups;
  return [
    !TYPES.includes(type) && `type "${type}" is unknown. Use one of ${TYPES.join(", ")}.`,
    scope !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(scope) && `scope "${scope}" is not a noun. ${SCOPE}`,
    !/^\S/.test(description) && `the description is missing. ${DESCRIPTION}`,
  ].filter(Boolean);
}
