# Capability receipts

One JSON receipt per verified skill, tool contract, or workflow capability, pinned to the exact tree SHA that was proven.

A receipt records that a capability ran on realistic input and passed an independent inspection. If the files under the capability change, the recorded `tree_sha` no longer matches `git rev-parse HEAD:<path>` and the capability drops back to `changed` until it is re-verified.

## States

- `untested`: no receipt exists yet, or no live run has been recorded.
- `ran`: the capability executed against realistic input, but an independent reviewer has not examined the output yet.
- `examined`: an independent reviewer inspected the output and recorded findings; not yet cleared for production use.
- `ready`: the capability ran on realistic input, passed independent examination at the pinned `tree_sha`, and has zero open blockers.
- `changed`: files under `path` changed after the receipt was signed, so `tree_sha` is stale and the capability needs re-verification.

## Rules

1. Never mark a capability `ready` from static reading or unit tests alone. Record a real execution in `evidence`.
2. Pin `tree_sha` to `git rev-parse HEAD:<path>` (or the exact commit SHA when scoping a single file).
3. Keep receipts committed beside `data/loading-receipts/`. Each receipt conforms to `schema.json` in this folder.
4. Keep sensitive client data, tokens, and raw payloads out of `evidence` and `note`.
