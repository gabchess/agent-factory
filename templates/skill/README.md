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
- `description` says what the skill is, then when to use it, in one to three sentences and at most 1024 characters. It is the only part an agent sees before it loads the skill, so lead with the words a person would type, and give each trigger its own branch.
- Every step is one action with a "Done when" an agent can verify without asking.
- Every step names what it uses: the tool, MCP server, other skill, command, or file to read or fetch, and the service or tech behind it when the agent must know it to act.
- Write for an agent that has never met the owner and has none of your memory or chat history. Name a person only with who they are and why the step needs them. Define every project name, path and term on first use, or point to where it is defined.
- Every line tells the agent what to do, what to use, what to check, what is allowed or what is not, or why a step exists. Cut a line that only comments on another document, such as a note about which words a check allows. Put that fact where the rule it changes lives.
- Write a preference that depends on the setup as a condition with a fallback: "When `<model or tool>` is available, use it. Otherwise use whatever the current harness offers." A bare "use X" fails on every harness that lacks X.
- A skill built around one person's preferences says whose they are in its `name` and first line, for example a `<person>-voice` skill that starts by saying it covers writing for that person on every surface.
- The order is the loading order: the summary, then the steps, then the output, then the background. An agent that stops reading after the steps still does the job.
- Say each rule once. Point to another skill or file by name instead of copying it.
- Keep `SKILL.md` under 500 lines. Move detail into `references/`, code into `scripts/` and files the skill copies into `assets/`, and point to each from the step that needs it.
- Nothing ties the skill to one harness: no slash commands, no tool names only one vendor has. Keys from the open SKILL.md standard (`license`, `compatibility`, `metadata`, `allowed-tools`) are allowed. A key that only one harness reads, such as one that hides the skill from the model, goes in that harness's notes under `data/`, not here.
- Every script runs alone: it uses only its runtime's standard library and reads no other file of the skill, so it works when copied into an empty folder. Some marketplaces run each script this way. Give each script a test that does exactly that, on the oldest runtime the skill supports.
- A skill that cannot work that way, because it needs installs, a container, a git tree or many modules, says so in its description and requirements. To sell it, build a method edition: a second skill that teaches the same job as steps, with every number from one self contained script.
- Every step that dispatches a subagent says to start it with a fresh context window. A forked conversation inherits the context the subagent was meant to escape.
- Put the recovery for a failure in the step where it happens. Stop only when no allowed path is left.
- Before it ships, a fresh agent with no other context gets the skill and a realistic request, but not the answer you expect, and its result meets every "Done when".
- Report the evidence you actually have, and only that. A parsed frontmatter, a passing script test, one agent run on a task and a harness that found and loaded the skill by itself are four different claims.
- Keep private material out: profiles, purchased lessons, raw transcripts and run outputs stay where they are. A skill keeps what it learned from them, not the files.

To sell or list a skill, use [sell-on-agensi](https://github.com/gabchess/skills/blob/main/skills/marketplace/sell-on-agensi/SKILL.md) in the skills repo. The skill itself stays the same.
