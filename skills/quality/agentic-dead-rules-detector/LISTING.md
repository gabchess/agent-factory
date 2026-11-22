# Listing: agentic-dead-rules-detector

## Package

- Status: the Agensi edition of Crash Lab, sold as Agentic Dead Rules Detector. Its one script, `scripts/dead-rules.mjs`, uses only the Node.js standard library, reads no other package file and stays under 20 KB, so it runs alone from a temporary file as Agensi requires (see `data/marketplaces/agensi.md`). The full lab in `skills/quality/crash-lab` stays a local install.
- Build the archive from a commit: `git archive --format=zip -o agentic-dead-rules-detector.zip HEAD:skills/quality/agentic-dead-rules-detector SKILL.md references scripts`. It holds `SKILL.md` at its root, plus `references/` and `scripts/`. This file, `media/` and `test/` stay out.
- The marketplace reads the name and description from the frontmatter, so those come from the skill unchanged.
- Agensi hosted tools: none. The agent sessions it starts run on the buyer's own agent and model account.

## Card

- Name: Agentic Dead Rules Detector: see which agent rules work
- Summary: Is that AGENTS.md rule doing its job, doing nothing, or making your agent worse? Runs your coding agent on the same task with and without it, each in a fresh session, and a check the agent never saw decides which version did the work right. Pass rates, intervals, cost and every failure.
- Logo: `media/logo.png`, 512 by 512

## Description

Your agent reads every rule in `AGENTS.md`, `CLAUDE.md` or a skill on every run. A rule can steer the work, do nothing, or quietly make it worse, and reading the file cannot tell you which. A rewrite that reads better can drop the one line that kept the agent away from a bug, and the session still ends as if it worked.

Agentic Dead Rules Detector runs the agent instead. Your agent builds controlled variants ("arms") of one coding task that differ by a single change, such as a deleted instruction line, a rewrite or a renamed field. Each run is a fresh session of the agent you already use, started in its own copy of the repository with no memory of the others. When a session ends, a verifier the agent never saw checks the work: exact outputs on held-out inputs, the repository's tests with skipped tests counted as failures, and no change to protected files. How the session ended is logged beside the verdict and never counts toward it.

Before any money is spent, the skill makes your agent prove the verifier: every known-bad fixture, built from a real past mistake or a tampering trick, has to fail. The runs start only after you name a spend cap, and a budget check before each run stops the experiment before it can cross it. That is a hard stop when your harness enforces a per-session spend limit. Without one, the check uses your agent's estimate of the next run, so a run that costs more than estimated can still go over.

You get a Markdown report with pass rates and 95% Wilson intervals, a Fisher exact test on one comparison chosen before the runs, the main phase's cost (the budget check adds smoke and pilot for the total against your cap), every failure grouped by reason, and a proposed decision for the instruction (keep, shorten, move into code, repair or remove). It says "inconclusive" when the data cannot tell, and never calls that equivalence.

"Dead" means what the numbers allow: no measurable effect at the number of runs you paid for. The report calls that inconclusive. Before you spend anything, `plan` shows which pass counts would reach significance at your planned run count, as a guide to how many runs to buy. The report then tests the one comparison you picked before the runs, on the runs your check judged pass or fail, and names a measured difference only when that test reaches significance: whether the rule helped, hurt, or a rename or a check did its job better. A rule also has to reach the agent to count: put it in a file your harness loads at the start of a session, because a rule in a file it never reads looks just as dead.

The numbers come from one dependency-free Node.js script. It works with any agent that can start a fresh session of itself, such as a headless CLI or a subagent with a fresh context. It does not sandbox those sessions: they run with your agent's usual permissions, so use a container or a throwaway VM if you have one.

## Demo

### Request

Our money code has a float helper with a comment saying "Floating-point division is fine for now; partner totals stay small." I think the comment makes the agent copy the hack. Before I delete it, measure whether the excuse comment changes how often the agent writes a correct export. My budget is $5.

### Result

The sessions below came from the full Crash Lab's excuse-contagion experiment on 2026-11-21: Claude Code 2.1.329 with `claude-sonnet-5-5`, 10 runs per arm. The report is this skill's `dead-rules.mjs report`, run on those 30 recorded results.

## Summary

The agent failed the same held-out check in 19 of the 20 runs that started next to the float helper, with or without the comment, and all 19 sessions ended normally. A helper that formats with integer math made every run pass. The comment's own effect is inconclusive at 10 runs per arm.

## Setup

- Verifier rehearsal: 6 of 6 fixtures matched before any paid run. Exporting through the float helper failed, with and without the comment, and so did a session that changed nothing. Fixing the helper and writing exact integer math both passed.
- Arms: E0 float helper with no comment, E1 the same helper with the excuse comment, E2 a helper that formats with integer string math.
- Plan: at 10 runs per arm, a 10 of 10 arm differs from another only when that one passes 5 or fewer. 39 runs with smoke and pilot, at about $0.08 each, fit the $5 cap.

## Report

| Arm | Runs | Pass | Fail | Pass rate | 95% Wilson | Cost | Ended normally, failed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E0 silent | 10 | 0 | 10 | 0% | 0% to 28% | $0.74 | 10 |
| E1 excused | 10 | 1 | 9 | 10% | 2% to 40% | $0.77 | 9 |
| E2 exact | 10 | 10 | 0 | 100% | 72% to 100% | $0.72 | 0 |

- Primary, E0 vs E1 (does the excuse comment lower the pass rate?): inconclusive: no difference detected at this size (p=1.000). This does not show the arms are equivalent.
- Exploratory, E0 vs E2 (does an exact helper raise the pass rate?): exploratory, no claim (p=0.000).
- Failures: 19 runs failed on `Q-09 (huge-refund) expected USD,-90071992547409.90, got USD,-90071992547409.91`.
- Cost: $2.22 for the main phase, $2.91 with smoke and pilot, of the $5.00 cap.

## Proposed change

```diff
 export function formatAmount(amount: number, currency: string): string {
   const digits = DECIMALS[currency];
   if (digits === undefined) throw new Error(`unknown currency ${currency}`);
-  return (amount / 10 ** digits).toFixed(digits);
+  const sign = amount < 0 ? "-" : "";
+  const whole = (amount < 0 ? -BigInt(amount) : BigInt(amount)).toString();
+  if (digits === 0) return sign + whole;
+  const padded = whole.padStart(digits + 1, "0");
+  return `${sign}${padded.slice(0, -digits)}.${padded.slice(-digits)}`;
 }
```

**Next steps**

- Replace the float helper with integer math as shown, and delete the comment.
- Open an issue for every other "for now" comment, so the hack behind it gets fixed.
- Rerun at 30 runs per arm if you still want a claim about comments alone.

## Compatibility

Follows the open SKILL.md standard. Works in any agent that can run shell commands and start a fresh session of itself, through a headless CLI (such as `claude -p`, `codex exec` or `gemini -p`) or a subagent with a fresh context window. Requires Node.js 18 or later and git.

## Requirements

- Required: Node.js 18 or later
- Required: Git
- Required: A coding agent that can start fresh sessions of itself
- Note: Planning and verifier rehearsal cost nothing. Each run is a real agent session billed to your own agent or model account, and runs start only after you name a spend cap.

## Permissions

- Tools used: terminal, read files, write files, network access
- Services: none beyond the agent account you already use
- File scopes: the lab folder you choose, and the temporary copies of your repository each run works in
- Why: the terminal runs Node, git, your verifier and new agent sessions. File reads and writes build the lab folder, the run copies and the report. Network access is only the model calls your own agent makes in each run; the script itself makes no network calls and reads no environment variables.

## Pricing

One-time, $9.

## Tags

- Tags: dead rules, agent evaluation, AGENTS.md, CLAUDE.md, prompt testing, coding agents, A/B testing, regression testing
- Categories: Developer tools, Testing and QA
- Use cases: find the AGENTS.md rules that change nothing; test an instruction change before merging it; find out whether an AGENTS.md line is load-bearing; check whether a code rename can replace an instruction; catch an agent that finishes cleanly on broken code

## FAQ

- Does it spend money? Only the runs do, on your own agent or model account, and only after you name a dollar cap. Planning, verifier rehearsal and the report are free.
- Which agents can it measure? The one you run it in, or any agent you can start headless from the terminal. Each run must be a fresh session with no memory of this conversation.
- Is each run sandboxed? Not by the skill. Runs use your agent's normal permissions in a temporary copy of your repository. Use a container or a throwaway VM for stronger isolation, and turn off user-level instructions, memory and skills for the runs, since they reach every arm.
- What counts as a dead rule? One whose arm shows no measurable difference from the arm without it, at the runs you paid for. That result is inconclusive, not proof that the rule does nothing: more runs can still find an effect. Check first that your harness loads the file the rule is in: Claude Code, for one, does not read `AGENTS.md` and loads a nested `CLAUDE.md` only on demand.
- Why did my comparison come back inconclusive? At 10 runs per arm, only large differences reach significance. Inconclusive means no difference was detected, never that the arms are the same. `plan` shows what your run count can detect before you spend anything.
- Does it work on macOS or Windows? Yes, wherever Node.js 18 or later, git and your agent run.

## Media

- Screenshots: none yet
- Demo video: none yet
