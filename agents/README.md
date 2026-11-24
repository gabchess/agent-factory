# agents

Agent definitions. Groups mirror the skill buckets in [gabchess/skills](https://github.com/gabchess/skills): `agents/reviews/` holds the reviewers that the `review-change` skill in gabchess/skills `skills/reviews/` dispatches.

`agents/orchestration/` holds the orchestrator and the worker contract that the `orchestrate-task` skill in gabchess/skills `skills/orchestration/` follows.

- [orchestrator](./orchestration/orchestrator/AGENT.md): takes a task, briefs one worker at a time, gates each attempt and reports. It never builds.
- [worker](./orchestration/worker/AGENT.md): the contract every worker follows: one brief in, one worker report out.
- [standards-reviewer](./reviews/standards-reviewer/AGENT.md): reviews a pinned diff against the reviewed repository's own standards.
- [spec-reviewer](./reviews/spec-reviewer/AGENT.md): reviews a pinned diff against the original task, its acceptance criteria and non-goals.
