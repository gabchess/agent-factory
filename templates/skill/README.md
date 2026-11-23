# Skill template

Skills live in [gabchess/skills](https://github.com/gabchess/skills). Copy `SKILL.md` into `skills/<bucket>/<skill-name>/` there and fill every placeholder. CI fails when a skill loses a frontmatter key or a section the template has, or puts the sections out of order. Extra sections and extra keys are fine.

## Is it a skill

| What you have | Where it goes |
| --- | --- |
| A method an agent needs only for some tasks | A skill |
| A short convention every task here follows | `AGENTS.md` |
| A decision and the evidence behind it | An ADR in `decisions/` |
| A rule a script can enforce | A check in `checks/` |
| Something that runs on a schedule or an event | An automation, not a skill |

Extend an existing skill when the job is the same. Start a new one when merging would mix two jobs.

## The bar

- `name` is lowercase letters, digits and hyphens, at most 64 characters, the same as the folder, and unique across the repo.
- `description` says what the skill is, then when to use it, in one to three sentences and at most 1024 characters. Lead with the words a person would type, one branch per trigger.
- Every step is one action with a "Done when" an agent can verify without asking.
- Every step names what it uses: tool, MCP server, skill, command, or file to read or fetch.
- Write for an agent with none of your memory. Name a person only with who they are. Define every project name and term, or point to its definition.
- Every line says what to do, use or check, or what is allowed. Cut the rest.
- Write a setup-dependent preference as a condition with a fallback: "When `<tool>` is available, use it. Otherwise use what the harness offers."
- A skill for one person's preferences names the person in its `name` and first line, as in `<person>-voice`.
- Order: summary, steps, output, background. An agent that stops after the steps still does the job.
- Say each rule once. Point to another skill or file by name instead of copying it.
- Keep `SKILL.md` under 500 lines. Move detail into `references/`, code into `scripts/` and files the skill copies into `assets/`, and point to each from the step that needs it.
- Nothing ties the skill to one harness: no slash commands, no tool names only one vendor has. Keys from the open SKILL.md standard (`license`, `compatibility`, `metadata`, `allowed-tools`) are allowed. A key that only one harness reads, such as one that hides the skill from the model, goes in that harness's notes under `data/`, not here.
- Every script runs alone: it uses only its runtime's standard library and reads no other file of the skill, so it works when copied into an empty folder. Give each script a test that does exactly that, on the oldest runtime the skill supports.
- A skill that cannot work that way, because it needs installs, a container, a git tree or many modules, says so in its description and requirements.
- Every step that dispatches a subagent says to start it with a fresh context window.
- Put the recovery for a failure in the step where it happens. Stop only when no allowed path is left.
- Before it ships, a fresh agent with no other context gets the skill and a realistic request, but not the answer you expect, and its result meets every "Done when".
- Report the evidence you actually have, and only that.
- Keep private material out: profiles, purchased lessons, raw transcripts and run outputs stay where they are. A skill keeps what it learned from them, not the files.

To sell or list a skill, use [sell-on-agensi](https://github.com/gabchess/skills/blob/main/skills/marketplace/sell-on-agensi/SKILL.md).
