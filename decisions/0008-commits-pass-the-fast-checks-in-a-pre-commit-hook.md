# Commits pass the fast checks in a pre-commit hook

A pre-commit hook runs gitleaks and the checks (`node checks/run.js --staged`) at once on the staged files. A found secret, a failing check or a check that cannot run refuses the commit; a gitleaks that is missing, will not execute or ends without a findings report warns that the staged files were not scanned and leaves the decision to the checks. It replaces the `AGENTS.md` line that asked agents to run the checks by hand before every commit, and tests stay out of it, because the suite alone takes longer than the hook's 3 second budget.

## Why

The written line was skipped twice in one day (Evidence). The hook runs the same checks with nothing to read or remember, on each commit that `git commit` makes: a new commit, `--amend`, the commit that concludes a conflicted merge, `git merge --continue` and a conflicted `git cherry-pick --continue`. A clean `git merge`, `git cherry-pick`, `git revert` and `git rebase`, and `git rebase --continue` after a conflict, make commits without it, so the checks at the PR head (ADR 0006) still judge what those bring.

1. It judges the staged files, since they are what the commit holds. A file left out of the commit cannot fail it, and a fix left unstaged cannot pass it.
2. It runs gitleaks itself, so a clone with only this hook still scans for secrets while its `checks/pre-commit.sh` is unmodified. Git runs that file from the working tree, so an edit to it, staged or not, changes what the next commit runs. `npm run hooks` writes the hook into the clone's shared `.git/hooks/`, the folder that the gitleaks hook in a global `core.hooksPath` chains to, so that chain stays whole. A local `core.hooksPath` would stop git from running the global hook here.
3. Gitleaks keeps the machine hook's rule, "block secrets, warn on crash". A found secret refuses the commit. A gitleaks that is missing, will not execute, or ends without a findings report prints a warning whose first line is always `pre-commit WARNING: NOT SCANNED FOR SECRETS.`, then why, the fix, and what to do next: the scan to run once git makes the commit, or that no commit was made when a check refuses it. The scan passes `--diff-merges=first-parent`, so it also reads a merge's conflict resolution. The commit goes on to the checks.
4. The checks fail closed. Node missing, or a checkout without `checks/run.js` or `checks/pre-commit.sh`, refuses the commit and names the fix. A staged snapshot that cannot be built refuses it with git's error.
5. Gitleaks and the checks run in parallel. The 3 second budget is the typical time of a commit through both hooks, never a guarantee: most commits measured 2.05 to 2.98 seconds, and some took far longer, up to 19.26 seconds, for a cause nobody has found (Evidence). `npm test` runs before every PR under ADR 0006, where its time costs one wait per PR.

The cost:

- A commit that got the warning lands unscanned by this hook until someone runs the scan the warning names. On a machine whose global hook already runs gitleaks, gitleaks runs twice, about 0.3 seconds more per commit, and a broken gitleaks warns twice.
- Each clone runs `npm run hooks` once. A worktree on a branch from before this hook cannot commit until it is rebased onto main.
- A commit runs the checked-out branch's own `checks/`, as `npm test` on that branch does, so a commit on someone else's branch runs their code. An edit that makes a check pass everything goes through the hook, since the hook runs the edited check; only the check's tests catch it, at the PR head.
- No protection is left when `GITLEAKS_BIN` points at a broken program or one that always passes. Both this hook and the machine's global hook read it, so a secret lands with only a warning, or with none, and CI runs no gitleaks.

## Considered options

- A local `core.hooksPath` to a tracked folder: git would skip the global gitleaks hook in this repo.
- Tests in the hook: `npm test` alone took 3.9 to 4.2 seconds at `f9194f6`.
- Refusing the commit when gitleaks is missing or crashes, as this hook did at first: a broken scanner would stop every commit in the repo, and the safety floor bans skipping the hook with `--no-verify`.

## Evidence

- On 2026-11-25 two PR heads reached CI with `npm run check` failing while `AGENTS.md` said to run it before every commit. PR 36 at `6397111`: "data/instructions.snapshot:59: snapshot is stale from this line." (Actions run 45644206937). PR 43 at `192e2f7`: "AGENTS.md:53:96: pointer without a condition." (Actions run 45713974602).
- Gabriel, 2026-11-26, asked which of two ideas he wanted for agent-factory, picked both: "A review also lists missing rules (Recommended), A fast pre-commit hook".
- Gitleaks: Gabriel's decision of 2026-11-04 for the machine's global gitleaks hook, which its header comment records as "block secrets, warn on crash".
- The checks: on 2026-11-26 a review of this hook found it refused every commit when gitleaks crashed or was missing, against that decision. Of three options, Gabriel picked "Refuse on crash only for the checks": a crashed or missing gitleaks warns and lets the commit through, and checks that cannot run refuse it.
- Which commands run the hook, in a throwaway repo on Git 2.56 whose hook logged each run: `git commit`, `git commit --amend`, the `git commit` after a conflicted merge, `git merge --continue` and a conflicted `git cherry-pick --continue` ran it. A clean `git merge --no-ff`, `git cherry-pick`, `git revert`, `git rebase` and a conflicted `git rebase --continue` did not. The 2026-11-26 review found the same.
- The scan the warning names: on a merge commit whose conflict resolution held a generated token, `gitleaks git --redact --log-opts=-1` scanned 0 commits and found no leaks, and with `--log-opts='-1 --diff-merges=first-parent'` it found 1.
- Time, on Windows 11 with Git 2.56, Node 26 and gitleaks 8.30.1, from git's trace2 events, through the global gitleaks hook. Author, five sets of five: a commit with nothing staged 2.11 to 2.54 seconds, one that changed a Markdown file 2.10 to 2.76, and 3 of the 50 over 3 seconds (3.39, 5.18 and 7.48), all in one set. Review: 11 of 54 commits over 3 seconds, the longest 19.26, the rest 2.05 to 2.98, with no part of the hook ever slow on its own. This hook alone took 0.97 to 1.22 seconds with real gitleaks and 0.71 to 0.74 with a stub that does nothing, so the second gitleaks adds about 0.3 seconds.
- At `f9194f6` the global hook alone took 0.96 to 1.06 seconds, gitleaks alone 0.68 to 0.74 and `run.js --staged` 0.35 to 0.38.
