# Commits pass the fast checks in a pre-commit hook

A pre-commit hook runs gitleaks and `npm run check` at once on the staged files, and refuses the commit when either fails or cannot run. It replaces the `AGENTS.md` line that asked agents to run the checks by hand before every commit. Tests stay out of the hook, because the suite alone runs past the hook's 3 second budget.

## Why

The written line was skipped twice in one day (Evidence). A hook runs the same checks on every commit with nothing to read or remember.

1. It judges the staged files, since they are what the commit holds. A file left out of the commit cannot fail it, and a fix left unstaged cannot pass it.
2. It runs gitleaks itself, so a clone with only this hook still scans for secrets. `npm run hooks` writes it into the clone's shared `.git/hooks/`, the folder that the gitleaks hook in a global `core.hooksPath` chains to, so that chain stays whole. A local `core.hooksPath` would stop git from running the global hook here.
3. A check that cannot run refuses the commit and names the fix: gitleaks or node missing, a gitleaks error with no report, or a checkout without `checks/pre-commit.sh`.
4. The checks run in parallel and fit 3 seconds. `npm test` runs before every PR under ADR 0006, where its time costs one wait per PR.

The cost: on a machine whose global hook already runs gitleaks, gitleaks runs twice, about one second more per commit. Each clone runs `npm run hooks` once. A worktree on a branch from before this hook cannot commit until it is rebased onto main. A commit runs the checked-out branch's own `checks/`, as `npm test` on that branch does, so a commit on someone else's branch runs their code.

## Considered options

- A local `core.hooksPath` to a tracked folder: git would skip the global gitleaks hook in this repo.
- Tests in the hook: `npm test` alone took 3.9 to 4.2 seconds.
- Letting the commit through when gitleaks fails without a report, as the global hook does: the commit would pass on a scan that never ran.

## Evidence

- On 2026-11-25 two PR heads reached CI with `npm run check` failing while `AGENTS.md` said to run it before every commit. PR 36 at `6397111`: "data/instructions.snapshot:59: snapshot is stale from this line." (Actions run 45644206937). PR 43 at `192e2f7`: "AGENTS.md:53:96: pointer without a condition." (Actions run 45713974602).
- Gabriel, 2026-11-26, asked which of two ideas he wanted for agent-factory, picked both: "A review also lists missing rules (Recommended), A fast pre-commit hook".
- Measured on Windows 11 with Git 2.56, Node 26 and gitleaks 8.30.1, five runs each, the hook timed by git's trace2 events. The global gitleaks hook alone took 0.96 to 1.06 seconds. With this hook chained after it, a commit with nothing staged took 2.25 to 2.62 seconds and one that changed a Markdown file 2.08 to 2.28 seconds. This hook alone took 0.99 to 1.03 seconds, gitleaks alone 0.68 to 0.74 and `run.js --staged` 0.35 to 0.38. `npm test` took 3.9 to 4.2 seconds.
