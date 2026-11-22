# Evidence rules

What the lab counts as a result, and what it refuses to claim.

## Verdicts

Each slot (one scheduled run of one arm) ends as one of four verdicts:

| Verdict | When |
| --- | --- |
| `pass` | The session completed, the held-out results match the oracle exactly, the agent's tests pass with none skipped, cancelled or todo, and no protected file changed |
| `fail` | Any of those checks failed, or the session timed out, hit its cost cap, or went over its turn or time limit |
| `unknown` | The harness errored on every retry, or the verifier itself broke |
| `not_run` | The next attempt could have crossed the spend cap, or the provider's credit ran out |

How each session ended is recorded. A session that timed out or hit its budget fails without verification, and a harness error makes the slot `unknown`. A normal finish (the lab's "claimed success") is counted but never passes a slot: only verification can. A report is invalid when more than the experiment's `invalidIfUnresolvedShareAbove` share of slots is unknown.

## Phases

- `smoke` checks the pipeline end to end. Never a finding.
- `pilot` measures cost, turns and time per attempt. Never a finding.
- `main` is the comparison, at a number of runs per arm fixed before any run. Only `main` can produce a finding.

Each phase runs once per run id. A rerun gets a new run id, and old results stay untouched.

## Statistics

- Every pass rate carries a 95% Wilson interval.
- Comparisons use a two-sided Fisher exact test. Only the one primary comparison can support a claim; the others are exploratory and say "no claim".
- At 10 runs per arm, if one arm passes 10 of 10, the other must pass 5 or fewer for p below 0.05. Most real effects look inconclusive at that size.
- Inconclusive means no difference was detected. It never shows the arms are equivalent.
- A case where every arm passes every run is saturated. It can still catch a regression but cannot show an improvement.

## Cost

- The ledger is cumulative across experiments, and it reserves each attempt's maximum cost before the attempt starts.
- `budget.capUsd` caps the whole ledger. `budget.experimentCapUsd` caps one experiment inside it.
- Each attempt records two figures: what the harness reported and what the lab charged, which is the larger of that report and the lab's own token pricing. Charged is the number held against the cap.
- After a run, compare the charged total with the provider's usage page. A gap you cannot explain blocks the next paid run.

## Evidence on disk

A live report is findings eligible only when every resolved slot links to its own native transcript, its artifact snapshot and, for a completed session, the verifier's result. Nothing under `results/` or `ledgers/` is ever edited or deleted after it is written. `node src/cli/main.ts reverify --run <phase dir> --experiment <file>` rebuilds each attempt from its snapshot and checks that the verdicts still match.
