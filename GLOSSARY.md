# Glossary

- **North star.** Why this repo exists: every agent Gabriel talks to follows the same standards, rules and skills, loaded from one place.
- **Harness.** The program that runs a model as an agent and loads its instructions and skills: Claude Code, Codex, Devin, Cursor, a Grok bot.
- **Agent.** A model running in a harness with a role, instructions and tools.
- **Orchestrator.** The agent that turns a goal into tasks, briefs workers, checks their work and reports. It never builds.
- **Worker.** A fresh agent that does one task from one brief.
- **Task.** One unit of work with a trigger, a done check and one writer.
- **Trigger.** What starts a run: a ticket state, a schedule, a webhook or a person.
- **Run.** One attempt at one task, recorded in `data/`.
- **Skill.** A folder with a `SKILL.md` that teaches an agent one workflow. Names are unique across the repo.
- **Template.** The file in `templates/` that every new artifact of one kind starts from. CI fails when a skill, agent, ADR or MCP contract drifts from its template.
- **Instruction snapshot.** `data/instructions.snapshot`, the exact text an agent loads here. CI fails when it is stale.
- **Check.** A script CI runs that fails on a broken rule and says how to fix it.
- **Pointer.** A line in an `AGENTS.md` that says when to read another file: "When you X, read Y". CI fails on a pointer to a missing file or one with no "When".
- **Fixture.** A small sample repo under `test/fixtures/<check>/` that a check must pass (`pass/`) or fail (`fail/`).
- **ADR.** A decision record in `decisions/`: the decision, why, and what result backs it.
- **Verdict.** An independent reviewer's pass or fail on one exact commit.
