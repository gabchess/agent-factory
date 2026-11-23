# agent-factory

Orchestrator → control the flow → structure outputs → execute actions → remember context → retrieve data → measure quality. README.md explains each step.

These rules hold for every agent working for Gabriel Abreu (GitHub `gabchess`), in any harness and any repo. Paths below are relative to this file's folder, the agent-factory clone. Where the repo you work in has a stricter rule, follow it there.

- This repo is the source of truth. Linear may link to any repo. No repo links to Linear.
- No em or en dashes anywhere, and no hyphen used as a dash in Markdown prose, except in `test/fixtures/`, which holds the failing examples for the checks. Rewrite the sentence with a comma, colon, period or parentheses. Write ranges as "44 to 51".
- One PR, one outcome. Never push to main. Open a PR; the owner, Gabriel (`gabchess`), merges it, unless he approved you merging that PR.
- Every line in a repo says what to do, use or check. Background and history go in the Linear ticket. ADRs in `decisions/` keep the context and reason their template asks for.
- Skills live in [gabchess/skills](https://github.com/gabchess/skills). When a skill named below is linked into your harness, load it by name. Otherwise read it at its link.

## Read when needed

Writing:

- When you write anything for Gabriel or in his name (a PR, commit, Linear ticket, README, doc, his GitHub profile, his website gabeonchain.com, a post or an email), read [the gabe-voice skill](https://github.com/gabchess/skills/blob/main/skills/disciplines/gabe-voice/SKILL.md). Its "Surfaces" table gives the rules for each place.
- When you title a PR, read `decisions/0005-pr-titles-follow-conventional-commits.md`.
- When you decide whether something goes in a repo or in Linear, read `decisions/0004-the-repo-holds-standards-linear-holds-planning.md`.

Building:

- When you create a skill, read `templates/skill/README.md`, copy `templates/skill/SKILL.md` into `skills/<bucket>/<name>/` in [gabchess/skills](https://github.com/gabchess/skills), and follow that repo's `AGENTS.md`.
- When you create an agent, ADR, MCP contract, lane brief or handover, read `templates/README.md`.
- When you add, cut or rewrite a line in any `AGENTS.md`, `CLAUDE.md`, rule or skill, read the "Is it a skill" table in `templates/skill/README.md`. Turn a rule a script can enforce into a check.
- When you need proof that an instruction line changes what an agent does, read [the crash-lab skill](https://github.com/gabchess/skills/blob/main/skills/quality/crash-lab/SKILL.md), or [agentic-dead-rules-detector](https://github.com/gabchess/skills/blob/main/skills/quality/agentic-dead-rules-detector/SKILL.md) when Docker is not available.

Running and reviewing work:

- When a run spends money on a model provider, read `decisions/0002-spend-is-capped-per-approval-before-money-moves.md` and get Gabriel's approved cap before the first paid call.
- When a run is unattended or long, read `decisions/0003-unattended-runs-are-bounded-probed-and-reconciled.md`.
- When you hand a task to another agent, read [the orchestrate-task skill](https://github.com/gabchess/skills/blob/main/skills/orchestration/orchestrate-task/SKILL.md) and `templates/prompt/README.md`.
- When you report work as done, read `decisions/0001-verification-and-reporting-keep-independent-evidence.md`.
- When you review a PR, a branch or a finished run, read [the review-change skill](https://github.com/gabchess/skills/blob/main/skills/reviews/review-change/SKILL.md).
- When you stop before the task is done, read `templates/handover/README.md` and fill `templates/handover/HANDOVER.md`.
- When you add or use an MCP server, read `tools/README.md`.

Harnesses:

- When you connect a harness to this repo, or move one off an old rules source, read [the join-factory skill](https://github.com/gabchess/skills/blob/main/skills/harnesses/join-factory/SKILL.md).
- When you rely on a harness loading `AGENTS.md` or a skill, read `data/README.md` for its loading receipt.

Other work:

- When you build a cinematic scroll page for a website, read [the 3d-cinematic-website skill](https://github.com/gabchess/skills/blob/main/skills/websites/3d-cinematic-website/SKILL.md).
- When you sell or list a skill on Agensi, read [the sell-on-agensi skill](https://github.com/gabchess/skills/blob/main/skills/marketplace/sell-on-agensi/SKILL.md).
- When no pointer here fits the task, read [the gabchess/skills index](https://github.com/gabchess/skills) for a skill that does.
- When you meet a term you do not know, or name a new concept, read `GLOSSARY.md`.

## In this repo

- Run `npm test` and `npm run check` before every commit.
- When you add a file to a top-level folder, read that folder's `README.md`.
- When you add or change a check, read `checks/README.md`.
- When you change an `AGENTS.md`, a skill or a tool contract, read `data/README.md` to regenerate the instruction snapshot.
