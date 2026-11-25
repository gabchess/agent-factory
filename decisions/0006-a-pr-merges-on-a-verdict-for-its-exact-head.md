# A PR merges on a verdict for its exact head

Every PR, rules and docs included, needs one approving verdict from a reviewer that did not write it, naming the full head SHA, and merges only at that SHA. The agent that opened the PR, or the agent that picks up its task, merges it once that gate passes. A PR that changes what customers or the public use or read, or that changes the safety floor, the deny list, the merge line in `AGENTS.md`, or ADRs 0002, 0006 or 0007, also needs Gabriel's yes.

## Rules

- Before you open a PR, run the repo's checks on the head and quote their last lines in the PR.
- The verdict's first line reads `APPROVE <full head SHA>` or `REQUEST CHANGES <full head SHA>`. The reviewer runs the repo's checks on that head and quotes their last lines in the verdict. That run is the green check.
- A CI job that never started counts for nothing. A job that started and failed still blocks the merge.
- When a CI job never starts and GitHub says "recent account payments have failed or your spending limit needs to be increased", the account's monthly GitHub Actions minutes for private repos are used up. Nothing needs fixing and nobody needs asking. The reviewer runs every check the CI jobs run, the PR title check included, on the head, and quotes their last lines next to the same run on main. That run is green only when every failure on the head also fails by name on main. This holds until the minutes reset or the repo goes public.
- The author never writes the verdict on its own change.
- A new head voids every verdict on the old one. Review the new head again.
- The agent that opened the PR, or the agent that picks up its task, merges it with the head pinned to the approved SHA (`gh pr merge --squash --match-head-commit <sha>`), so the merge fails when a commit landed after the verdict.
- A PR that changes what customers or the public use or read (a product, an app, his website, a store listing, published content), or that changes the safety floor or the merge line in `AGENTS.md`, `templates/deny-list/`, or ADRs 0002, 0006 or 0007, merges only after Gabriel's yes. Rules, docs, skills and code in a public repo are not public content, unless merging the repo publishes it (his website, his GitHub profile README). The yes is given in the PR, in the chat, or as a standing yes for a named batch or repo.
- When round 2 of a review names a new form of the flaw round 1 named, the fix deletes the carrier: the field, text path or type that lets the bad value through. Moving or merging a filter is still a patch. The fix may land in the same PR.
- A test that checks a guard covers a set takes the set from the real producer, such as the tool's own output. Never take it from the code under test or a hand-typed list.
- A review from a model family other than the author's is optional and never a merge condition. Its finding blocks the merge only when it shows a bug.

## Why

A verdict is evidence about one commit. A push after it changes what merged, and an author who approves its own work passes work that fails. Text an agent follows is behavior, so a rules or skills PR gets the same verdict as code. One revert PR undoes a squash merge, so an author merging after a non-author verdict costs little when it is wrong. A change customers or the public already saw does not come back that way, so it keeps Gabriel's yes. The cost: each PR waits for a second agent, and each push restarts the review.

## Evidence

- 0 unflagged escapes in 60 merged PRs that a non-author reviewer approved, from 2026-10-30 to 2026-11-14 (95 percent upper bound about 5 percent). The audit cannot see silent bugs. Source: gabchess/vault-agentops `40-RESEARCH/2026-11-14-reviewer-escape-audit.md` at `137b4c6`.
- Rules PR catch: gabchess/skills PR 21 changed only two `SKILL.md` files, and its non-author review caught the verdict line placed last in the review report. Fixed in gabchess/skills `4f9e3e7`.
- Gabriel's standing yes, 2026-11-24: "code-reviewer from agentskit can review, then if all things pass, ci/cd green and everythign goes smoothly, yall merge it, i trust you on this one". On 2026-11-25 he chose "Apply all" for the audit that made agent merges the rule (Linear GAB-842).
- Second form: a key leak in one PR came back in three forms and was removed only at the fourth try, with a typed error (`50-LEARNINGS/2026-11-06-helius-build-failures.md`, row 5). Four PRs for a verdict parser closed on one carrier, the parser itself (`50-LEARNINGS/2026-11-07-verdict-check-parser-closed.md`). Both at `137b4c6`.
- Real producer: gabchess/agent-rules PR 88 (commit `cc5a406`) added the rule after a retro of patched redesigns. The retro run test T14 takes its step list from the recorded calls of a clean run (`40-RESEARCH/2026-11-14-retro-run-state-machine.md` at `137b4c6`).
- Cross-model: on 2026-10-31 a read-only review on a different model family found 6 real issues that two reviewers from the author's family missed, and a second run found 6 more (`20-ADRS/0028-cross-model-review-runs-on-codex.md` at `137b4c6`). It became optional on 2026-11-18, when a required three-family gate held PRs for many rounds.
- Actions minutes: on 2026-11-24 every CI job on the private repos gabchess/skills and gabchess/maquina-de-produtos failed before it started, with the billing message above. An agent read it as a payment problem and asked the owner to fix billing. The owner, 2026-11-25: "there's nothing to fix about gituhub actions, they're just out of quota/limit ... you can keep local tests as green until that happens". The same block stopped four PRs in gabchess/thoth-lab on 2026-11-17 (gabchess/vault-agentops `20-ADRS/0001-autonomous-merge-policy.md` line 16 at `297dd87`; the 2026-11-24 messages are in gabchess/maquina-de-produtos PR 63 and Linear GAB-842).
- The old gate had five homes that disagreed (ADR 0004). This ADR replaces gabchess/agent-rules `rules/pull-requests.md` at `562fe19` and vault ADRs 0001 and 0028.
