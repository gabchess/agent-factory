# MCP write-verb guard template

Portable specification for a harness pre-tool hook that distinguishes read-only MCP calls from state-mutating calls. Use this alongside `list.json` when a harness attaches new MCP servers whose exact tool names are not enumerated ahead of time.

## Default posture

1. Read-only calls run without prompting when they match an explicit read verb and carry no mutation parameters.
2. State-mutating calls fail closed and require explicit human approval before execution.
3. Unknown verbs default to requiring human approval rather than silent execution.

## Verb classification

| Category | Example tool name prefixes or segments | Default action |
| --- | --- | --- |
| Read-only | `get_`, `list_`, `read_`, `search_`, `query_`, `find_`, `describe_`, `inspect_`, `whoami` | Allow within lane scope |
| Write or publish | `create_`, `save_`, `update_`, `edit_`, `write_`, `post_`, `send_`, `publish_`, `schedule_`, `merge_`, `approve_`, `trigger_` | Require explicit human approval |
| Destructive or irreversible | `delete_`, `remove_`, `drop_`, `purge_`, `revoke_`, `wipe_`, `force_push_`, `archive_` | Deny unless named in an approved ticket and signed off by the owner |

## Hook behavior

When implementing this guard in a harness (for example a Claude Code `PreToolUse` hook or a gateway middleware):

1. Inspect the normalized tool name (`mcp__<server>__<tool>` or `<server>:<tool>`).
2. Always evaluate static entries from `list.json` first; this template never overrides or weakens `list.json`.
3. If the tool name matches any destructive or write verb, block execution with a clear message naming the server, tool, and required approval path.
4. Log every blocked and approved call to the session audit log with timestamp, server, tool, decision, and `approved_by` when approved.
5. Never log raw credential values, cookies, or request bodies containing PII.
