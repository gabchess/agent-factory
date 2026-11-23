# Spend is capped per approval before money moves

Every approval that lets a run spend money carries a limit. The runner enforces that limit before each paid attempt starts, and a limit written only in a prompt or a chat message does not count.

## Why

Money spent on a model provider does not come back, so the runner checks the limit before the spend:

1. Before an attempt starts, the runner reserves the maximum cost for that attempt. The attempt starts only when the reservation fits under both the approval's remaining allowance and the shared cap.
2. One shared ledger records every attempt across all approvals. Each entry names the approval it counts against, so a single total guards the provider's limit while each approval keeps its own allowance.
3. The ledger records the cost the harness reports alongside the cost computed from tokens at the provider's prices, and charges the attempt the higher figure.
4. The provider's own spending limit is the backstop. It is never the control.

An approval is usually smaller than the shared cap and scoped to one piece of work. Lowering the shared cap to match one approval would break other runs on the same ledger, and a second ledger would split the total that guards the provider's limit.

The cap controls only which attempts may start. Because a running attempt can finish above its reservation, the total overshoot can reach the combined overruns of all attempts in flight. Run one attempt at a time when an approval is tight.

## Evidence

From gabchess/agent-workflow-crash-lab:

- Gabriel approved $5 for the excuse-contagion experiment while the shared cap stood at $80. The runner enforced the $5, and the run ended at $2.91 charged ($1.74 reported by the harness). Commit `126040c`, record [`docs/checkpoints/2026-11-21.md`](https://github.com/gabchess/agent-workflow-crash-lab/blob/9c99f07/docs/checkpoints/2026-11-21.md).
- The harness reported less than token pricing: $2.19 reported against $3.60 charged on the 2026-11-21 main run. Commit `76a5844` started charging the higher figure.
- Source decision: [`docs/decisions/0013-per-experiment-spend-caps.md`](https://github.com/gabchess/agent-workflow-crash-lab/blob/af7ef70/docs/decisions/0013-per-experiment-spend-caps.md).
