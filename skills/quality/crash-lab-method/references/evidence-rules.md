# Evidence rules

What a report counts as a result, and what it refuses to claim.

## Verdicts

| Verdict | When |
| --- | --- |
| `pass` | The session ended and the verifier passed the run's folder |
| `fail` | The verifier failed the folder, or the session timed out or hit a limit |
| `unknown` | The harness errored, or the verifier itself broke |
| `not_run` | The next run could have crossed the spend cap |

Pass rates count only `pass` and `fail`. A session that ended normally is recorded but never passes a run: only the verifier can. A report is invalid when more than `invalidIfUnresolvedShareAbove` of its runs are `unknown` or `not_run`, or when its lines do not match the plan exactly (a missing, repeated or unplanned run).

## Phases

- Smoke checks the setup end to end. Never a finding.
- Pilot measures the cost and time of one run. Never a finding.
- Main is the comparison, at a number of runs per arm fixed before it starts. Only main can produce a finding.

A rerun goes into a new results file. Old results stay as they are.

## Statistics

- Every pass rate carries a 95% Wilson interval.
- Comparisons use a two-sided Fisher exact test. Only the primary comparison can support a claim.
- At 10 runs per arm, if one arm passes 10 of 10, the other must pass 5 or fewer for p below 0.05. `plan` prints this table for any size. Most real effects look inconclusive at 10 runs.
- Inconclusive means no difference was detected. It never shows the arms are equivalent.
- A task where every arm passes every run is saturated. It can still catch a regression but cannot show an improvement.

## Cost

- `budget` sums `costUsd` over the phase file and refuses the next run when it could cross `budget.capUsd`.
- The cap covers one phase file. Add the phases together when you report the experiment's total.
- After a run, compare the total with the provider's usage page. A gap you cannot explain blocks the next paid run.
