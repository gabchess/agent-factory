# A PR merges on a verdict for its exact head

Every PR is either docs-only or code. A docs-only PR merges once the repo's checks pass on its head. A code PR also needs one approving verdict from a reviewer who did not write it, naming the full head SHA, and merges only at that SHA.

## Rules

- A docs-only PR changes only Markdown that agents or maintainers read, such as rules, ADRs, skills and READMEs, plus files the repo regenerates from them, such as an instruction snapshot, and nothing a product or public page shows. Every other PR is a code PR, including one that changes text a product or public page shows.
- Before you open a PR, run the repo's checks on the head and quote their last lines in the PR.
- When a CI job never starts and GitHub says "recent account payments have failed or your spending limit needs to be increased", the account's monthly GitHub Actions minutes for private repos are used up. Nothing needs fixing and nobody needs asking. Run the repo's checks locally on the head, quote their last lines and every failure by name next to the same run on main, and count that as green until the minutes reset or the repo goes public.
- The verdict's first line reads `APPROVE <full head SHA>` or `REQUEST CHANGES <full head SHA>`. The reviewer runs the repo's checks on that head before writing it.
- The author never writes the verdict on its own change.
- A new head voids every verdict on the old one. Review the new head again.
- The owner merges, or the agent he approved for that PR (`AGENTS.md`). Merge a code PR with the head pinned to the approved SHA (`gh pr merge --squash --match-head-commit <sha>`), so the merge fails when a commit landed after the verdict.
- When round 2 of a review names a new form of the flaw round 1 named, the fix deletes the carrier: the field, text path or type that lets the bad value through. Moving or merging a filter is still a patch. The fix may land in the same PR.
- A test that checks a guard covers a set takes the set from the real producer, such as the tool's own output. Never take it from the code under test or a hand-typed list.
- A review from a model family other than the author's is optional and never a merge condition. Its finding blocks the merge only when it shows a bug.

## Why

A verdict is evidence about one commit. A push after it changes what merged, and an author who approves its own work passes work that fails. Docs-only PRs skip the verdict because one PR reverts a wrong line of prose, and on 2026-11-13 the owner ruled that a PR editing only rules files is docs-only. The cost: each code PR waits for a second agent, and each push restarts the review.

## Evidence

- 0 unflagged escapes in 60 merged PRs that a non-author reviewer approved, from 2026-10-30 to 2026-11-14 (95 percent upper bound about 5 percent). The audit cannot see silent bugs. Source: gabchess/vault-agentops `40-RESEARCH/2026-11-14-reviewer-escape-audit.md` at `137b4c6`.
- Second form: a key leak in one PR came back in three forms and was removed only at the fourth try, with a typed error (`50-LEARNINGS/2026-11-06-helius-build-failures.md`, row 5). Four PRs for a verdict parser closed on one carrier, the parser itself (`50-LEARNINGS/2026-11-07-verdict-check-parser-closed.md`). Both at `137b4c6`.
- Real producer: gabchess/agent-rules PR 88 (commit `cc5a406`) added the rule after a retro of patched redesigns. The retro run test T14 takes its step list from the recorded calls of a clean run (`40-RESEARCH/2026-11-14-retro-run-state-machine.md` at `137b4c6`).
- Cross-model: on 2026-10-31 a read-only review on a different model family found 6 real issues that two reviewers from the author's family missed, and a second run found 6 more (`20-ADRS/0028-cross-model-review-runs-on-codex.md` at `137b4c6`). It became optional on 2026-11-18, when a required three-family gate held PRs for many rounds.
- Actions minutes: on 2026-11-24 every CI job on the private repos gabchess/skills and gabchess/maquina-de-produtos failed before it started, with the billing message above. An agent read it as a payment problem and asked the owner to fix billing. The owner, 2026-11-25: "there's nothing to fix about gituhub actions, they're just out of quota/limit ... you can keep local tests as green until that happens". The same block stopped four PRs in gabchess/thoth-lab on 2026-11-17 (gabchess/vault-agentops `20-ADRS/0001-autonomous-merge-policy.md` line 16).
- The old gate had five homes that disagreed (ADR 0004). This ADR replaces gabchess/agent-rules `rules/pull-requests.md` at `562fe19` and vault ADRs 0001 and 0028.
