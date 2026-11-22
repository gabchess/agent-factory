---
name: agentic-dead-rules-detector
description: Tests whether a rule in a coding agent's instructions (AGENTS.md, CLAUDE.md, a skill or a rule file) changes what the agent does, helps it, quietly breaks it or has no measurable effect, by running each variant of one task in fresh sessions of the agent you already use and letting a check the agent never saw judge the result. Use when someone wants evidence before trimming, rewriting or adding an instruction, wants to know which rules are dead weight, or when an agent keeps repeating a mistake and they want to know whether a rule, a rename or a check fixes it, without installing the full Crash Lab.
---

# Agentic Dead Rules Detector

Runs the same coding task against variants ("arms") of an agent's starting instructions, each in a fresh session, then lets a verifier the agent never saw decide which arms produced correct work. No paid run starts until the verifier has failed every known-bad fixture and the person has named a spend cap.

All numbers come from one script, `scripts/dead-rules.mjs`. It uses only the Node.js standard library and reads no other file in this skill. Run every command from the lab folder, so the paths below resolve there: `node <path to>/dead-rules.mjs <command>`, written `node dead-rules.mjs` below. Every command prints Markdown, exits 1 when its check fails and exits 2 when the call itself is wrong.

Keep the experiment in a lab folder outside the target repository, laid out as `references/experiment-format.md` describes. Nothing but `task.md` and the arm's files may reach a run: no other lab file, and no user-level instructions, memory or skills from the harness.

## Steps

1. Check the script runs: `node dead-rules.mjs plan --runs 10`. Done when it prints the plan table. The script needs Node.js 18 or later; the verifier also needs whatever runtime the target repository's tests need.
2. Find the mistake worth testing. Read the target repository's git log, bug fix commits and review comments for a mistake that agents or people repeat, and the instruction line meant to prevent it. Done when you can name the mistake, link one commit or comment that shows it, and quote the instruction line under test. When the history shows no such mistake, name the mistake the line is meant to prevent, label it hypothesized in the lab notes and the report, and say so to the person.
3. Try to make the mistake impossible before testing words about it. Check, in this order, whether a change to the code's structure, a type, a lint whose error names the fix, or a test would stop it with no instruction at all. Done when the person has chosen one of: encode it and skip the experiment, test the instruction, or test both (a code change can be its own arm). When the request already says which, take it and tell them what you found.
4. Write the task, the arms and the verifier in the lab folder. `task.md` is the only prompt every run gets. Each arm is a set of files copied over the repository at one pinned commit, instruction files or a code change, and the current instructions are the baseline arm. The verifier is a command that takes a run's folder, exits 0 for correct work, exits 1 with the reason on the first line of standard output for wrong work, and exits with any other code when it breaks: it checks exact outputs on held-out inputs, runs the repository's tests with skipped and todo tests counted as failures, and fails any change to a protected file. List the protected files in the lab notes (tests, fixtures, the arm's instruction files and anything else the task does not ask the agent to edit) and compare each with the arm's starting copy; the files the task asks the agent to change are never protected. When the line under test is a rule about how the code is written, the verifier also checks the rule and names it in the reason. Leave out held-out cases that a different known bug fails in every arm, and write that choice in the lab notes: a floor at 0 hides the effect of the line. When the task touches retries, concurrency or event ordering, it also replays those cases and checks the transitions and side effects, not only the final output. Done when `task.md`, every arm and the verifier exist and a search for each held-out input and expected output finds nothing outside `verify/` and `fixtures/`.
5. Rehearse the verifier: `node dead-rules.mjs rehearse --good fixtures/good-a,fixtures/good-b --bad fixtures/bad-a,fixtures/bad-b -- <verifier command with {dir}>`. Each bad fixture replays the mistake from step 2 or a tampering trick (a skipped test, an edited protected file, no change at all). Done when every line says `ok` and each bad fixture's output names the mistake it replays. A bad fixture that passes, or one that only crashes the verifier, means the check proves nothing: fix the verifier, never the fixture.
6. Pre-register the experiment in `experiment.json`: the arms, runs per arm, one primary comparison, the unresolved limit and the cap you will propose, following `references/experiment-format.md`. Then run `node dead-rules.mjs plan --runs <n> --arms <k> --cost-per-run <usd> --cap <usd>`. The cost per run is the harness's per-session spend limit; set one when the harness has it. Without one, estimate from the model's price and say it is an estimate. The plan prices smoke, pilot and main together. Done when the person has seen which differences this size can detect and the estimated cost next to the cap. If the plan prints `Over the ... cap`, cut runs or ask for a higher cap; never raise it yourself.
7. Get the spend approved. Every run is a real agent session billed to the person's own model account or API key. Show the cap in `budget.capUsd` and ask the person to approve it or name another. Done when the person has said in this conversation that they approve a number and `budget.capUsd` holds it. A budget they mention is not an approval.
8. Run the phases in order, each into its own results file: smoke (one run per arm, `results-smoke.jsonl`), pilot (two per arm, `results-pilot.jsonl`), then main (`results.jsonl`). For each run, in an order that alternates arms (A0, B0, A1, B1 and so on):
   - Run `node dead-rules.mjs budget --experiment experiment.json --results results-smoke.jsonl,results-pilot.jsonl,results.jsonl --next-cost <usd>`, so one cap covers every phase. The next cost is the harness's per-run limit when it enforces one; without one, the step 6 estimate, and after smoke the larger of that and twice the costliest run so far. A file not written yet counts as empty. On exit 1, record every remaining run as `not_run` and stop.
   - Copy the repository at the pinned commit into a new folder outside the lab folder, apply the arm's files, and start a new agent session there with a fresh context window and no memory of this conversation: the harness's headless mode (such as `claude -p`, `codex exec` or `gemini -p`) or a subagent started with a fresh context. Give it `task.md` and nothing else.
   - When the session ends, however it ended, run the verifier on that folder and append one line to the phase file, as `references/experiment-format.md` describes.
   Before main, compare the pilot's cost with the plan. Done when every planned main run has exactly one line in `results.jsonl`.
9. Report: `node dead-rules.mjs report --experiment experiment.json --results results.jsonl > report.md`. Done when `report.md` exists. If it says `Valid: **no**`, report why and make no claim from it. When you report results someone else collected, say whether `experiment.json` was written before their runs or rebuilt afterwards.
10. Close the run: compare the report's cost with the provider's usage page for the same window. Done when both numbers and any gap are written in the summary, or the summary says no provider figure was available.

## Output

Hand back the path to `report.md` and a short summary with:

- one row per arm: passes out of runs, pass rate and its 95% Wilson interval;
- the primary comparison's verdict, quoted from the report;
- the cost from the report next to the provider's figure;
- every failure reason, and how many runs ended normally but failed the verifier;
- one proposed decision for the instruction (keep, shorten, move into code, repair, remove) as a diff for a person to review.

An inconclusive result is never "the arms are equivalent", and smoke and pilot results are never findings.

## Background

Read this only when a step is unclear or its rule is questioned.

- Why fixtures come first: Ray Fernando's rule for agent-made checks is to "prove each check catches a real past mistake before you trust it", after Lauren Tan's warning that a check "could be proving false is true". Step 5 is that rule.
- Why step 3 exists: the same post orders the fixes as architecture, then types, then a lint whose error names the fix, then a test. An instruction is the weakest of these, so test it only when the stronger ones do not fit.
- Why the verifier checks more than the final output: in the full Crash Lab's `excuse-contagion` experiment, 19 of 20 sessions that started next to a float helper ended normally and failed the held-out check. How a session ended says nothing about the work.
- Isolation is the person's harness, not this skill: the full Crash Lab runs each session in a Docker sandbox with only the model API reachable and a ledger that reserves each attempt's cost. This method keeps the held-out verifier out of every run folder and caps spend between runs, and nothing more. Prefer a container or a throwaway VM for the run folders when one is available.
- Why the provider's figure matters: a harness's own cost report has run below the provider's bill, so the summary carries both.
- When you lay out the lab folder or write a results line, read `references/experiment-format.md`.
- When you plan the number of runs, read a report or explain a verdict, read `references/evidence-rules.md`.
