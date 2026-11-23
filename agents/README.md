# agents

Agent definitions. Groups mirror the skill buckets in [gabchess/skills](https://github.com/gabchess/skills): `agents/reviews/` holds the reviewers that the `review-change` skill in `skills/reviews/` dispatches.

- [standards-reviewer](./reviews/standards-reviewer/AGENT.md): reviews a pinned diff against the reviewed repository's own standards.
- [spec-reviewer](./reviews/spec-reviewer/AGENT.md): reviews a pinned diff against the original task, its acceptance criteria and non-goals.
