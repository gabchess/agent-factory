# agent-factory

The rules, skills, agents, decisions and checks every agent working for Gabriel Abreu (GitHub `gabchess`) follows, on any harness.

## How it works

Orchestrator → control the flow → structure outputs → execute actions → remember context → retrieve data → measure quality.

1. **Orchestrator.** Takes a task, routes it, gates it and reports. It never builds.
2. **Control the flow.** Defines success and the checks that prove it before any work starts.
3. **Structure outputs.** Every artifact starts from its template in `templates/`.
4. **Execute actions.** Sends each worker a brief that names the skills and tools to use, then checks that the worker uses them.
5. **Remember context.** Tickets and specs live in Linear; the person who gave you the task names the ticket. Rules and decisions live here.
6. **Retrieve data.** Agents load `AGENTS.md` and follow its pointers only when the task needs them.
7. **Measure quality.** "Done" and green CI are claims. Only an independent review of one exact commit is a verdict.

## Layout

| Folder | Holds |
|---|---|
| `agents/` | Agent definitions, grouped like `skills/` |
| `skills/` | A pointer to [gabchess/skills](https://github.com/gabchess/skills), where every skill lives |
| `tools/` | MCP contracts and access rules |
| `data/` | The instruction snapshot and run records |
| `templates/` | One template per artifact kind |
| `decisions/` | ADRs, 60 lines at most each |
| `checks/` | The scripts CI runs against this repo |

## Checks

Node 22 or later. No dependencies.

```sh
npm test       # the checks' own tests
npm run check  # the checks against this repo
npm run check:title -- "<title>"  # a PR title against decisions/0005
```
