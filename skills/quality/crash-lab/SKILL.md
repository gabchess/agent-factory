---
name: crash-lab
description: Tests whether a change to a coding agent's instructions (AGENTS.md, CLAUDE.md, a skill or a rule) makes its work better or quietly breaks it, by running controlled variants of one task in fresh sandboxed sessions and letting held-out checks judge the code. Use when someone wants evidence before trimming, rewriting or adding an instruction, or when an agent keeps repeating a mistake and they want to know whether a rule, a rename or a check fixes it.
---

# Crash Lab

Runs the same coding task against variants ("arms") of an agent's starting instructions, then lets checks the agent never saw decide which arms produced correct code. No paid run starts until the verifier has failed every known-bad fixture for the right reason and the person has approved a spend cap.

Run every command below from this skill's `scripts/` folder. The bundled task is a partner order export with an ambiguous `amount` field, chosen because agents get it wrong in ways a test can catch. A new arm can carry any instruction file, so the person's own AGENTS.md or CLAUDE.md can be measured against it. A task of a different shape needs a new held-out runner (see Background).

## Steps

1. Install the lab: if `scripts/` is not inside a git repository, run `git init -q && git add -A && git commit -qm "Install crash-lab"` there, since every run freezes the code by its git tree. Then run `npm ci`, `npm test` and `npm run typecheck`. Done when the test summary shows `fail 0` and the type check prints nothing. Needs Node 22.18 or a later 22.x on Linux, and Docker for the sandbox tests. On another Node major, install Node 22 first; do not edit `engines`.
2. Prove the bundled verifier: `node src/cli/main.ts audit`, then `node src/cli/main.ts fixtures` and `node src/cli/main.ts fixtures --case excuse-contagion`. Done when every arm prints `clean` and every fixture line starts with `ok`. A `MISS` line means the verifier cannot be trusted: stop and report the line.
3. Find the mistake worth testing. Read the target repository's git log, bug fix commits and review comments for a mistake that agents or people repeat, and the instruction line meant to prevent it. Done when you can name the mistake, link one commit or comment that shows it, and quote the instruction line under test.
4. Try to make the mistake impossible before testing words about it. Check whether a name, a type, a lint whose error names the fix, or a test would stop it with no instruction at all. Done when the person has chosen one of: encode it and skip the experiment, test the instruction, or test both (a code change can be its own arm, as `legacy-cents` arm A3 renames a field).
5. Write the arms. Add each variant to a case's `case.json` as an arm of `copy`, `deleteLine` or `replace` operations, following `references/case-format.md`. Keep the current instructions as the baseline arm. Done when `node src/cli/main.ts audit --case <id>` prints `clean` for every arm.
6. Rehearse the verifier on the new arms. Add a known-good fixture for each arm family and a known-bad fixture that replays the real mistake from step 3, each bad one naming the reason that must catch it in `reasonIncludes`. Done when `node src/cli/main.ts fixtures --case <id>` prints `ok` for every line. A bad fixture that passes means the check proves nothing: fix the check, never the fixture.
7. Pre-register the experiment. Copy `experiments/legacy-cents.json`, set the arms, fixed runs per phase, one primary comparison, the hypotheses, the per attempt limits and the pricing table, and leave `budget.confirmed` false. Then run `node src/cli/main.ts plan --experiment <file> --low <usd> --high <usd>` with the lowest and highest cost you expect per attempt. Done when the person has seen the expected and worst case dollars next to the cap. If the plan prints `"fitsCap": false`, cut runs per arm or ask for a higher cap; never raise it yourself.
8. Get the spend approved. Live runs call the Anthropic API with the person's `ANTHROPIC_API_KEY` and cost real money. Ask for a dollar cap, write it as `budget.experimentCapUsd`, and let the person set `budget.confirmed` to true. Done when they approved a number and the file shows `"confirmed": true`. Never set it yourself.
9. Probe the sandbox for free: `node src/cli/main.ts sandbox-probe --experiment <file>`. Done when every probe row passes. A failed row blocks the paid run until you can explain it.
10. Run the phases in order, each under a new run id: `node src/cli/main.ts run --experiment <file> --phase smoke --run-id <id>`, then `pilot`, then `main`. Before `main`, compare the pilot's charged cost with the plan. Done when `results/runs/<id>/main/report.md` exists. If the runner stops with slots `not_run`, the cap was reached: report it, never raise the cap yourself.
11. Close the run. Ask the person to set `budget.confirmed` back to false, and compare the report's charged total with the provider's usage page for the same window. Done when the flag is false and any gap is written down.

## Output

Hand back the path to the main phase `report.md` and a short summary with:

- one row per arm: passes out of runs, pass rate and its 95% Wilson interval;
- the primary comparison's verdict, quoted from the report;
- cost reported by the harness and cost charged by the lab;
- every failure reason, and how many runs claimed success but failed the checks;
- one proposed decision for the instruction (keep, shorten, move into code, repair, remove) as a diff for a person to review.

Leave out what the report cannot carry: an inconclusive result is never "the arms are equivalent", and smoke and pilot results are never findings.

## Background

Read this only when a step is unclear or its rule is questioned.

- Why fixtures come first: Ray Fernando's rule for agent-made checks is to "prove each check catches a real past mistake before you trust it", after Lauren Tan's warning that a check "could be proving false is true". Step 6 is that rule.
- Why step 4 exists: the same post orders the fixes as architecture, then types, then a lint whose error names the fix, then a test. An instruction is the weakest of these, so test it only when the stronger ones do not fit.
- Why excuse comments matter: Matt Pocock's comment triage and poteto's `no-comments` skill treat "for now" comments as permission for hacks. The bundled `excuse-contagion` case measured it: in 19 of 20 runs next to a float helper the agent claimed success and the held-out check failed.
- Why the verifier checks more than the final output: a pass needs exact held-out results, passing repository tests with none skipped or todo, and no protected file changed, so output that only looks right still fails.
- Why charged and reported cost differ: the harness's own cost figure ran below the provider's bill, so the lab charges the larger of the reported cost and its own token pricing.
- When you write a case or an arm, read `references/case-format.md`.
- When you read a report, plan N, or explain a verdict, read `references/evidence-rules.md`.
- When the task under test is not an orders to CSV export, the held-out runner in `scripts/src/artifact-verification/heldout.ts` and its oracle must be replaced for that task; the rest of the lab stays the same.
