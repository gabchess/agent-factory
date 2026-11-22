# Listing: crash-lab

## Package

- Build the archive from a commit: `git archive --format=zip -o crash-lab.zip HEAD:skills/quality/crash-lab SKILL.md references scripts`. It holds `SKILL.md` at its root, plus `references/` and `scripts/`. This file and `media/` stay out.
- The marketplace reads the name and description from the frontmatter, so those come from the skill unchanged.
- Agensi hosted tools: none. Live runs call the Anthropic API with the buyer's own key.

## Card

- Name: Crash Lab: test agent instructions before you ship them
- Summary: Runs your coding agent on the same task with and without an instruction change, in fresh sandboxed sessions, and lets hidden checks decide which version wrote correct code. Reports pass rates with intervals, cost and every failure.
- Logo: `media/logo.png`, 512 by 512

## Description

Most changes to `AGENTS.md`, `CLAUDE.md` or a skill are reviewed by reading the diff, which cannot show which lines change what the agent does. A rewrite that reads better can drop the one rule that kept the agent from a bug, and the agent will still report success.

Crash Lab runs the agent instead. It builds controlled variants ("arms") of one coding task that differ by a single change, such as a deleted instruction line, a rewrite or a renamed field. Each run is a fresh agent session in its own Docker sandbox with only the model API reachable. When a session ends, a verifier the agent never saw runs the produced code on held-out inputs, runs the agent's own tests with skips and todos counted as failures, and fails any run that touched a protected file. The agent's own report of success is logged beside the verdict and does not count toward it.

Before any money is spent, the skill makes the agent prove the verifier: every known-bad fixture, built from a real past mistake or a tampering trick, has to fail for the stated reason. Live runs need a spend cap you approve, and the runner reserves each attempt's cost before starting it.

You get a Markdown report with pass rates and 95% Wilson intervals, a Fisher exact test on one pre-registered comparison, the cost the harness reported next to the cost the lab charged, every failure reason, and a proposed decision for the instruction (keep, shorten, move into code, repair or remove). It says "inconclusive" when the data cannot tell, and never calls that equivalence.

Two cases ship with it. `legacy-cents` tests whether a "minor units" instruction line is load-bearing. `excuse-contagion` tests whether a "fine for now" comment on a float helper spreads the hack into new code. Add your own instruction file as a new arm to measure it on either task.

## Demo

### Request

Our money code has a float helper with a comment saying "Floating-point division is fine for now; partner totals stay small." I think the comment makes the agent copy the hack. Before I delete it, measure whether the excuse comment changes how often the agent writes a correct export. My budget is $5.

### Result

## Summary

The agent failed the same held-out check in 19 of the 20 runs that started next to the float helper, with or without the comment, and claimed success in all 19. Fixing the helper made every run pass. The comment's own effect is inconclusive at 10 runs per arm.

## Setup

- Verifier rehearsal: 6 of 6 fixtures matched before any paid run. Exporting through the float helper failed, with and without the comment, and so did a session that changed nothing. Fixing the helper and writing exact integer math both passed.
- Sandbox probe: 42 of 42 checks passed, $0 spent.
- Arms: E0 float helper with no comment, E1 the same helper with the excuse comment, E2 a helper that formats with integer string math.
- Model `claude-sonnet-5-5` in Claude Code 2.1.329, 10 runs per arm in the main phase, order randomized in blocks.

## Main phase

| Arm | Pass | Pass rate | 95% Wilson | Claimed success, failed | Reported USD |
| --- | --- | --- | --- | --- | --- |
| E0 silent | 0 of 10 | 0% | 0% to 28% | 10 | 0.74 |
| E1 excused | 1 of 10 | 10% | 2% to 40% | 9 | 0.77 |
| E2 exact | 10 of 10 | 100% | 72% to 100% | 0 | 0.72 |

- Primary, E0 vs E1 (does the excuse comment lower the pass rate?): inconclusive, p=1.000. No difference was detected at this N, and this does not show the arms are equivalent.
- Exploratory, E0 vs E2: p=0.000, no claim.
- Every failure was one held-out row: 9007199254740990 minor units came out as `...409.91` instead of `...409.90`.
- The one E1 pass rewrote `formatAmount` while adding currencies.

## Cost

| Phase | Reported by Claude Code | Charged against the cap |
| --- | --- | --- |
| Smoke | $0.15 | $0.24 |
| Pilot | $0.26 | $0.44 |
| Main | $1.33 | $2.22 |
| Total | $1.74 | $2.91 of $5.00 |

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

Follows the open SKILL.md standard and works in any agent that can run shell commands. The agent under test in live runs is Claude Code 2.1.329, pinned inside the Docker sandbox. Requires Node.js 22.18 or a later 22.x on Linux, and Docker.

## Requirements

- Required: Node.js 22.18 or later 22.x
- Required: Docker
- Required: Linux
- Optional: Anthropic API key (live runs only)
- Note: Offline steps cost nothing. Live runs bill your Anthropic API key, $2.91 for the bundled 39 run demo, and start only after you approve a spend cap. On macOS or Windows, run it inside a Linux VM.

## Permissions

- Tools used: terminal, read files, write files, network access, environment variables
- Services: anthropic.com (Anthropic API), docker.com (Docker Engine and base image)
- File scopes: `scripts/**`, `/tmp/**`
- Why: the terminal runs Node, npm and Docker. File reads and writes build arms, fixtures and reports inside `scripts/` and temporary workspaces under `/tmp`. Network installs npm packages, pulls the pinned Docker image and, in live runs only, reaches `api.anthropic.com` through an allowlisted proxy. The environment variable is `ANTHROPIC_API_KEY`, read only for live runs.

## Pricing

One-time, $9.

## Tags

- Tags: agent evaluation, AGENTS.md, CLAUDE.md, prompt testing, coding agents, Claude Code, A/B testing, regression testing
- Categories: Developer tools, Testing and QA
- Use cases: test an instruction change before merging it; find out whether an AGENTS.md line is load-bearing; check whether a code rename can replace an instruction; catch an agent that claims success on broken code

## FAQ

- Does it spend money? Only in live runs, on your Anthropic API key, and only after you approve a dollar cap. Install, fixture rehearsal, audits and the sandbox probe are free.
- Can I test my own AGENTS.md or CLAUDE.md? Yes. Add it as an arm on one of the two bundled tasks. A task with a different input or output shape needs its own held-out runner, which the skill explains.
- Which agents can run the skill? Any agent that follows SKILL.md and can use a terminal. The agent being measured in live runs is Claude Code.
- Why did my comparison come back inconclusive? At 10 runs per arm, only large differences reach significance. Inconclusive means no difference was detected, never that the arms are the same.
- Does it work on macOS or Windows? Not natively. It runs on Linux with Docker, so use a Linux VM or a Linux CI runner.

## Media

- Screenshots: none yet
- Demo video: none yet
