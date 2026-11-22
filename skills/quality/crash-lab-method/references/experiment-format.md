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
  experiment-smoke.json
  experiment-pilot.json
  notes.md             the mistake, the choices behind the verifier, anything hypothesized
  results-smoke.jsonl
  results-pilot.jsonl
  results.jsonl
```

Run every `crashlab.mjs` command from the lab folder. Keep the lab folder outside the target repository and outside every run folder. A run that can read `verify/` or `fixtures/` has seen the answer, and its result counts for nothing.

## Verifier

Any command that takes one folder and exits 0 for correct work, 1 for wrong work with the reason on the first line of standard output, and any other code when it breaks. Catch your own errors and exit 2, so a crash never reads as a caught mistake. `rehearse` puts the folder where the command says `{dir}`, for example `node verify/check.mjs {dir}` or `bash verify/check.sh {dir}`. It runs without a shell, with a two minute limit per fixture.

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
- `budget.capUsd`: the dollar cap for the whole experiment, proposed in step 6 and approved in step 7. No run starts before the approval.

For smoke and pilot, copy the file to `experiment-smoke.json` and `experiment-pilot.json` with `runsPerArm` set to 1 and 2, for their reports. `budget` always reads the cap from `experiment.json`.

## Results line

One JSON object per line, one line per run, appended after the verifier finishes:

```json
{"arm":"E1","run":0,"verdict":"fail","costUsd":0.08,"endedNormally":true,"reason":"Q-12 printed 0.00, expected 0"}
```

- `arm` and `run`: the arm id and the run's index, from 0 to `runsPerArm - 1`.
- `verdict`: `pass` or `fail` from the verifier; `fail` also when the session crashed, timed out or hit a limit; `unknown` when the harness could not start or finish the session or the verifier itself broke; `not_run` when `budget` stopped the run before it started.
- `costUsd`: what the session cost, from the harness's usage output. Required on every line but `not_run`; a line without it is refused. Use the per-run limit when the harness gives no figure, and say so in the summary.
- `endedNormally`: true when the session finished without an error, a timeout or a limit.
- `reason`: the verifier's failure message, or what went wrong.
