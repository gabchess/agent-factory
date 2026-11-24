// Compares a Claude Code settings.json against templates/deny-list/. Run it with run-deny-list.js.

const FIX = "Add it to permissions.deny in that settings.json, from templates/deny-list/claude-code.json.";

// Claude Code reads "~/" as the home folder and "//c/Users/x/" as an absolute path, so both name the same file.
function absolute(rule, home) {
  const path = home.split("\\").join("/").replace(/^([A-Za-z]):/, (_, drive) => drive.toLowerCase()).replace(/^\/+/, "");
  return rule.replace("(~/", `(//${path}/`);
}

export function check(settings, list, claudeCode, home) {
  const deny = new Set(settings?.permissions?.deny ?? []);
  return list.flatMap(({ id }) => {
    const rules = claudeCode[id];
    if (!Array.isArray(rules)) return [`entry "${id}" has no Claude Code mapping. Add "${id}" to templates/deny-list/claude-code.json, with [] when no rule can express it.`];
    return rules
      .filter((rule) => !deny.has(rule) && !deny.has(absolute(rule, home)))
      .map((rule) => `missing deny rule "${rule}" (entry "${id}"). ${FIX}`);
  });
}
