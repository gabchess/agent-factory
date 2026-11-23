# Verification and reporting keep independent evidence

A worker's report of success is a claim. The verdict on a run comes from a verifier the worker cannot read or change, and the run record keeps the raw evidence behind that verdict.

## Why

A worker that grades its own work passes work that fails. The verifier owns the verdict, and every run follows six rules:

1. The verifier copies the final artifact before running any check, so verification leaves the worker's output untouched.
2. The expectations stay outside the worker's reach, hidden from both the worker and the code under test.
3. A pass requires exact agreement with the expectations, every test run with zero failed, skipped, or disabled tests, and every protected file untouched during the run and verification.
4. When the verifier breaks, the verdict is unknown.
5. The system saves raw output before parsing it, keeping any line the parser cannot read in the record.
6. A report counts a run only when the run record links the saved artifact to its verdict, allowing anyone to rebuild the artifact and verify it again.

This requires a separate verification environment and artifact storage for every run, which slows execution.

## Evidence

Live runs in gabchess/agent-workflow-crash-lab tested these rules:

- The first live run on 2026-11-20 passed 40 of 40 slots and was revoked the same day. Its verifier accepted sorted output, missing tests, and test files the candidate rewrote during verification. Its report accepted unlinked evidence and kept no artifacts, preventing re-verification of any verdict. Record: [`results/REVOKED.json`](https://github.com/gabchess/agent-workflow-crash-lab/blob/af7ef70/results/REVOKED.json). Fixes: commits `c24584f` and `59f3d92`.
- In the excuse-contagion run on 2026-11-21, the agent claimed success in 19 of the 20 runs that used the float helper, and the held-out check failed each of them. Rebuilding all 39 attempts from their saved artifacts reproduced every verdict. Record: [`docs/checkpoints/2026-11-21.md`](https://github.com/gabchess/agent-workflow-crash-lab/blob/9c99f07/docs/checkpoints/2026-11-21.md).
- Source decision: [`docs/decisions/0012-verification-and-reporting-contracts.md`](https://github.com/gabchess/agent-workflow-crash-lab/blob/af7ef70/docs/decisions/0012-verification-and-reporting-contracts.md).
