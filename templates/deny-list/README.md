# Deny list template

Apply this list to every harness when you connect it to this repo, and again when the list changes. `list.json` names each denied action and the safety floor line in `AGENTS.md` it enforces. The other files map it to one harness each.

| File | Harness | Apply it |
| --- | --- | --- |
| `claude-code.json` | Claude Code | Gabriel adds every rule to `permissions.deny` in `~/.claude/settings.json`. Then run `npm run check:deny -- ~/.claude/settings.json`. |
| `codex.rules` | Codex shell commands | Copy it to `~/.codex/rules/deny-list.rules`. |
| `codex.toml` | Codex MCP tools | Merge each `disabled_tools` list into the matching `[mcp_servers.<name>]` table of `~/.codex/config.toml`. |
| `instructions.md` | a harness with no deny setting, and the Codex entries below | Paste its list into the harness's instructions. |
| `mcp-write-guard.md` | any harness running pre-tool hooks over MCP servers | Implement its read versus write verb guard on top of `list.json` so unknown mutating MCP tools fail closed. |

- Codex rules match shell command prefixes only. Codex gets `read-secret-files` and `paid-call-without-cap` from `instructions.md`, and the Gmail and GitHub connector tools too once those servers are added to Codex.
- `paid-call-without-cap` has no Claude Code rule, because no tool name marks a paid call. [ADR 0002](../../decisions/0002-spend-is-capped-per-approval-before-money-moves.md) sets the cap.
- To add an entry, add it to `list.json` with its floor line, then to every mapping in the same PR.
