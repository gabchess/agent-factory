# Experiment format

The lab folder, the experiment file and the results lines that `crashlab.mjs` reads.

## Lab folder

```text
lab/
  task.md              the only prompt each run gets
  arms/<arm id>/       instruction files copied over the repository for that arm
  verify/              the held-out verifier and its expected outputs
  fixtures/good-*/     work the verifier must pass
  fixtures/bad-*/      work the verifier must fail
  experiment.json
  results-smoke.jsonl
  results-pilot.jsonl
  results.jsonl
```

Keep the lab folder outside the target repository and outside every run folder. A run that can read `verify/` or `fixtures/` has seen the answer, and its result counts for nothing.

## Verifier

Any command that takes one folder and exits 0 for correct work and nonzero otherwise. `rehearse` puts the folder where the command says `{dir}`, for example `node verify/check.mjs {dir}` or `bash verify/check.sh {dir}`. It runs without a shell, with a two minute limit per fixture.

## experiment.json

```json
{
  "id": "excuse-comment-v1",
  "arms": ["E0", "E1"],
  "runsPerArm": 10,
  "invalidIfUnresolvedShareAbove": 0.1,
  "budget": { "capUsd": 5 },
  "comparisons": [
    { "a": "E0", "b": "E1", "role": "primary", "question": "Does the excuse comment lower the pass rate?" }
  ]
}
```

- `arms`: at least two arm ids, the baseline first.
- `runsPerArm`: fixed before the main phase starts. Never change it after seeing results.
- `comparisons`: exactly one with `role` `primary`. Any other role is exploratory and never supports a claim.
- `invalidIfUnresolvedShareAbove`: the share of `unknown` and `not_run` runs above which the report is invalid. Defaults to 0.1.
- `budget.capUsd`: the dollar cap the person approved.

For smoke and pilot, copy the file with `runsPerArm` set to 1 and 2.

## Results line

One JSON object per line, one line per run, appended after the verifier finishes:

```json
{"arm":"E1","run":0,"verdict":"fail","costUsd":0.08,"endedNormally":true,"reason":"Q-12 printed 0.00, expected 0"}
```

- `arm` and `run`: the arm id and the run's index, from 0 to `runsPerArm - 1`.
- `verdict`: `pass` or `fail` from the verifier; `unknown` when the harness errored or the verifier itself broke; `not_run` when `budget` stopped the run before it started.
- `costUsd`: what the session cost, from the harness's usage output. Use the most a run can cost when the harness gives no figure, and say so in the summary.
- `endedNormally`: true when the session finished without an error, a timeout or a limit.
- `reason`: the verifier's failure message, or what went wrong.
