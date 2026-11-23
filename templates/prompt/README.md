# Prompt templates

The orchestrator fills `lane-brief.md` for each worker, and the worker fills `worker-report.md` in return. Both live with the task, not in this repo, so CI does not check filled copies. The `orchestrate-task` skill in [gabchess/skills](https://github.com/gabchess/skills/blob/main/skills/orchestration/orchestrate-task/SKILL.md) reads both.

- Quote the owner's words (see "Owner" in `GLOSSARY.md`).
- Name every skill as `- Load: \`<name>\`` and every tool or MCP server as `- Use: \`<name>\``. The gate compares the brief's names with the report's, exactly.
- Give every brief a loop cap and at least one stop condition under `## Limits`. The gate refuses a brief without them.
- One brief, one writer. When two workers would change the same path, split the task.
