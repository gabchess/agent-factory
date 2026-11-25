# A line lands only when it passes the survival test

Every new rule, `AGENTS.md` line, skill line, ADR and check passes the survival test before it lands, in this repo and in gabchess/skills. So does every line carried over from the old sources. A line that fails stays out.

## Rules

A line survives only when all four hold:

1. A recorded failure or catch stands behind it: a run, a review finding or a logged correction from Gabriel. A line with no record survives only when it guards harm that cannot be undone: secrets, spend, public posts, `main` and the deletion of data.
2. The agent cannot see it in the repo or work it out alone. A line that repeats `package.json`, a config, `--help` or another rule fails.
3. It does not turn a lesson into a new check by default. One failure earns a line. A check lands when the same failure is recorded twice, or when it replaces a surviving line that a script can enforce.
4. It changes what the current model does, compared with the same instructions without it. When a reviewer doubts that it does, cut the line, unless a blind comparison under a standing budget ([ADR 0002](0002-spend-is-capped-per-approval-before-money-moves.md)) shows it does: [the crash-lab skill](https://github.com/gabchess/skills/blob/main/skills/quality/crash-lab/SKILL.md), or [agentic-dead-rules-detector](https://github.com/gabchess/skills/blob/main/skills/quality/agentic-dead-rules-detector/SKILL.md) when Docker is not available, with one arm with the line and one without, judged by a check the agent never sees. A safety floor line in `AGENTS.md` is exempt, like the harm exception in criterion 1.

- Name the failure or catch for criterion 1 in the PR that adds the line. An ADR names it in its Evidence section.
- A line that was cut comes back only when a recorded failure shows that its absence caused the failure.
- When a harness moves to a new default model, run criterion 4 again on the lines that harness loads.

## Why

Every line adds reading for every agent on every task. In the old AgentOps most rules had no catch behind them, and the few that caught bugs were easy to name. Criterion 4 exists because a line can pass the first three and still change nothing on the current model, and reading the line cannot tell you which. The cost: a real lesson waits for its failure to be recorded, a check waits for the second failure, and a doubted line is cut unless a crash lab run keeps it.

## Considered options

- Vault ADR 0051's three criteria unchanged: they never ask whether the line changes behavior, so a no-op line passes.
- Settling uncertain lines by argument in review: a reviewer cannot see what the model does without the line, and a blind comparison can.
- Asking Gabriel to approve a cap for each doubted line: a line that cannot show its effect costs reading on every task, and cutting it is undone by one PR.

## Evidence

- The 2026-11-12 audit behind vault ADR 0051 found 44 ADRs with 2,770 lines, and a running check backed 3 of them. Real catches in the last 20 sessions came from a non-author review whose reviewer picked its own mutations, the Codex cross-review, CodeRabbit and the second-form close. No catch was found for the status gate, the no-questions-in-loops rule or the local guards. Source: gabchess/vault-agentops `20-ADRS/0051-agentops-v2-keep-what-caught-bugs.md`, context and section 1, at `137b4c6`.
- Criterion 4: in the crash lab run `claude-2026-11-21-main`, arm A0 carried the minor-unit line and arm A2 removed it. Both passed 10 of 10 on `claude-sonnet-5-5` (p=1.000). At N=10 the run detected no difference, which does not prove the arms equivalent. Record: [`docs/checkpoints/2026-11-21.md`](https://github.com/gabchess/agent-workflow-crash-lab/blob/9c99f07/docs/checkpoints/2026-11-21.md). Arms: [`README.md`](https://github.com/gabchess/agent-workflow-crash-lab/blob/9c99f07/README.md).
- Gabriel chose "Apply all" on 2026-11-25 for the audit that made a doubted line a cut by default (Linear GAB-842).
- The agent-factory design spec, revision 4, section 5, pass 1, kept ADR 0051's three criteria as the audit gate and added criterion 4 from the crash lab. The spec lives in Linear.
