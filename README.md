# agent-factory

The one source of truth for the rules, skills, agents, decisions and checks that every agent working for Gabriel Abreu (GitHub `gabchess`, the owner of this repo) follows, whatever harness runs it: Claude Code, Codex, Devin, Cursor or a Grok bot. Write everything here for an agent that has never met him and has none of his chat history.

## How it works

Orchestrator → control the flow → structure outputs → execute actions → remember context → retrieve data → measure quality.

1. **Orchestrator.** A task, goal or trigger reaches the orchestrator. It routes, gates and reports. It never builds.
2. **Control the flow.** It defines success first: what good looks like, and the checks that prove it.
3. **Structure outputs.** Every artifact starts from its template in `templates/`.
4. **Execute actions.** It calls the right agent with the right model, and a brief that names the skills and tools the task needs. Then it watches that the agent uses them and does the job well.
5. **Remember context.** Plans and tickets live in the owner's Linear workspace; the brief that started your task names the ticket. Rules, decisions and run records live here, in git.
6. **Retrieve data.** Agents load a small `AGENTS.md` and follow its pointers to the rest, only when the task needs it.
7. **Measure quality.** A worker saying "done" and green CI are claims. Only an independent review of one exact commit counts as a verdict.

## Layout

| Folder | Holds |
|---|---|
| `agents/` | Agent definitions, grouped like `skills/` |
| `skills/` | A pointer to [gabchess/skills](https://github.com/gabchess/skills), where every skill lives |
| `tools/` | MCP contracts and access rules |
| `data/` | Memory, run records, evals and audit tables |
| `templates/` | One template per artifact kind |
| `decisions/` | ADRs, 60 lines at most each |
| `checks/` | The scripts CI runs against this repo |

## Checks

Node 22 or later. No dependencies.

```sh
npm test       # the checks' own tests
npm run check  # the checks against this repo
```
