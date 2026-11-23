# The repo holds standards, Linear holds planning

This repo holds what every agent follows: rules, ADRs, templates, checks, agent definitions and run records. Linear holds planning: projects, tickets, research notes, open questions and the work in flight. Linear links to this repo, and this repo never links to Linear.

## Why

A rule with one home stays consistent. When a rule lives in five homes, someone updates four of them and misses the fifth.

1. When a ticket decides something every agent must follow, move that decision into this repo as an ADR or a rule and write out its full context here.
2. Every change in this repo goes through a reviewed PR. Tickets can change without review, so this repo never depends on ticket text.
3. Any agent in any harness can read this repo from a local clone. Some harnesses lack access to Linear, and an unreachable link leaves the agent without context.
4. Linear tickets can link to any file, commit or PR here to cite their source.

`checks/no-linear-links.js` fails CI on links to the Linear app domain. It does not catch other Linear domains. The cost: context a ticket already holds gets written out again here.

## Evidence

- The old AgentOps stated its merge gate in five places, and they disagreed. gabchess/vault-agentops `20-ADRS/0001-autonomous-merge-policy.md` decision 1, its `20-ADRS/0051-agentops-v2-keep-what-caught-bugs.md` section 3 and gabchess/agent-rules `rules/pull-requests.md` line 1 said no GitHub Actions check gates a merge. gabchess/agent-rules `AGENTS.md` line 7 (commit `562fe19`) said "The `test` check must pass before merge", while its `.github/` holds only `dependabot.yml`.
- The vault's `README.md` rule 1 (commit `137b4c6`) still cites ADR 0014 for the night board, which ADR 0051 dropped.
- The old AgentOps Linear project summary named "ADR 0023, Level 7" as its goal after ADR 0051 deleted ADR 0023.
- Gabriel picked "Linear + repo" over "vault + repo" on 2026-11-21, recorded in revision 4 of the agent-factory design spec, which lives in Linear.
