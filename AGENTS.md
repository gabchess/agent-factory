# agent-factory

Orchestrator → control the flow → structure outputs → execute actions → remember context → retrieve data → measure quality. README.md explains each step.

- This repo is the source of truth. Linear may link here. Nothing here links to Linear.
- Run `npm test` and `npm run check` before every commit.
- No em or en dashes anywhere, and no hyphen used as a dash in Markdown prose, except in `test/fixtures/`, which holds the failing examples for the checks. Rewrite the sentence with a comma, colon, period or parentheses. Write ranges as "44 to 51".
- One PR, one outcome. Never push to main.

## Read when needed

- When you write prose a person will read, read [the writing skill](https://github.com/gabchess/skills/blob/main/skills/disciplines/writing/SKILL.md) in gabchess/skills.
- When you meet a term you do not know, or name a new concept, read `GLOSSARY.md`.
- When you add a file to a top-level folder, read that folder's `README.md`.
- When you add or change a check, read `checks/README.md`.
- When you create a skill, agent, ADR, MCP contract, lane brief or handover, read `templates/README.md`.
- When you change an `AGENTS.md`, a skill or a tool contract, read `data/README.md` to regenerate the instruction snapshot.
