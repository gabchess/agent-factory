# Capability receipts

A capability receipt records that a skill, tool contract or workflow ran on realistic input, pinned to the Git tree SHA of the files that ran. When those files change after the run, the SHA no longer matches and the receipt shows the claim is stale.

## Files

- A skill's receipts live in `data/capability-receipts/` of its own repo, such as gabchess/skills, written by [the capability-acceptance skill](https://github.com/gabchess/skills/blob/main/skills/quality/capability-acceptance/SKILL.md). This folder holds the receipts for agent-factory's own capabilities.
- Write one file per state change at `<capability>/<verified_at>.json`, with the colons in `verified_at` replaced by `-`, for example `<capability>/2026-11-25T15-40-00Z.json`. Each file conforms to `schema.json` in this folder.
- Receipts are append only, like the other run records in `data/`. Never edit or delete a receipt. A new run, a review or a fix appends a new file.
- The newest receipt wins: the file in `<capability>/` with the latest `verified_at` gives the capability's state. Older files are history.

## States

- `ran`: the capability ran on realistic input. Record the run in `evidence`. A capability with no receipt has not run.
- `examined`: a reviewer who is not the author inspected the output of that run and recorded findings.
- `ready`: the run passed that review at `tree_sha` and `open_blockers` is empty. Never write `ready` from static reading or unit tests alone.

## Recording a receipt

1. In a clone of `repo` where `git status --porcelain -- <path>` prints nothing, run `git rev-parse HEAD:<path>` and record the result as `tree_sha`. That gives a tree SHA for a folder and a blob SHA for a single file. Never record a commit SHA.
2. Append `ran` after the run, then `examined` or `ready` after the review. A `ready` for a new `tree_sha` needs a new run at that SHA behind it.

## Checking a receipt

Before you rely on a capability's "it works" claim, read its newest receipt and, in a clone of `repo`:

1. Run `git status --porcelain -- <path>` and check that it prints nothing, since the SHA covers only committed files.
2. Run `git rev-parse HEAD:<path>` and compare it with `tree_sha`.

When the SHAs differ or the status is not clean, the receipt is stale. Report a stale receipt as a warning that names both SHAs, and append a new receipt after a new run. A stale receipt warns; it does not fail a check or block a merge.
