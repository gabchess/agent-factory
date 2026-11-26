Points agents at capture-learning when a live correction or verified workaround reveals a reusable rule or workflow.

## Changes
- AGENTS.md: adds one pointer line under Read when needed -> Building directing live corrections to gabchess/skills skills/quality/capture-learning/SKILL.md (proposal-first before editing instruction files).
- data/instructions.snapshot: regenerated via 
pm run snapshot.

## Verification
- 
pm run check: pass (0 findings)
- 
pm test: 41/42 pass on Windows (sole failure is CRLF fixture double-replace in 	est/instruction-snapshot.test.js on core.autocrlf=true)
<!-- devin-review-badge-begin -->

---

<a href="https://app.devin.ai/review/gabchess/agent-factory/pull/42" target="_blank"><picture><source media="(prefers-color-scheme: dark)" srcset="https://static.devin.ai/assets/gh-devin-review-dark.svg?v=4"><img src="https://static.devin.ai/assets/gh-devin-review-light.svg?v=4" alt="Devin Review"></picture></a>
<!-- devin-review-badge-end -->
