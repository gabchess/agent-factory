# Unattended runs are bounded, probed and reconciled

Every unattended or long agent run in any harness follows six steps. Step 5 runs from the first attempt to the end. The orchestrator checks every other step before it lets the next one start.

## Why

No person watches an unattended run, so its limits and checks exist before it starts, and its record grows as it runs:

1. Bound the run before it starts. Write down what done means, how to check the result, what the run may touch, what stops it, and where the result goes. Spend follows [0002](0002-spend-is-capped-per-approval-before-money-moves.md). When a newer instruction narrows an approval, stop the run and then ask.
2. Run a free probe before the first paid attempt. That $0 probe tests the real sandbox, network allowlist, credentials, and instruction loading. Any probe failure blocks the paid run until the cause is fixed and the probe passes again.
3. Escalate in phases from a small run to a larger one, and then to the full run. Run each phase once under a new run id, and compare its cost with the estimate before starting the next phase.
4. Let the verifier judge the run under [0001](0001-verification-and-reporting-keep-independent-evidence.md). The agent's own report is a claim.
5. Write attempts, transcripts, artifacts, and charges to disk during the run, and never edit them afterward. A crash or a new session recovers state from these files, and so does a context compaction.
6. Reconcile the tokens the run recorded against the provider console for the same time window after the run ends. An unexplained gap blocks the next paid run. Turn off live execution when the approved run ends.

## Evidence

From gabchess/agent-workflow-crash-lab:

- The free probe before the excuse-contagion run passed 41 of 42 checks and caught a missing credential at $0. The paid run started only after the rerun passed 42 of 42. Record: [`docs/checkpoints/2026-11-21.md`](https://github.com/gabchess/agent-workflow-crash-lab/blob/9c99f07/docs/checkpoints/2026-11-21.md).
- On 2026-11-20, the main phase of run `claude-2026-11-20-b` started under an earlier approval about a minute before Gabriel said to finish only the pilot. The runner was stopped after 8 of 40 slots, and the killed slot was charged its $2 reservation. The 8 finished slots were verified again from the saved attempts. Record: [`results/runs/claude-2026-11-20-b/main/INTERRUPTED.json`](https://github.com/gabchess/agent-workflow-crash-lab/blob/af7ef70/results/runs/claude-2026-11-20-b/main/INTERRUPTED.json).
- After the 2026-11-21 main run, the provider console showed 2,412,254 tokens for the day, matching the sum of the run's 40 transcripts. Same checkpoint record.
- Source decision: [`docs/decisions/0014-unattended-runs-are-bounded-probed-and-reconciled.md`](https://github.com/gabchess/agent-workflow-crash-lab/blob/af7ef70/docs/decisions/0014-unattended-runs-are-bounded-probed-and-reconciled.md).
