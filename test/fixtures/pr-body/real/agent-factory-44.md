```text
$ git rev-parse HEAD
2a831a590e94d3cbce30298b3efca08a738a81b8
$ npm test
ℹ tests 50
ℹ pass 50
ℹ fail 0
$ npm run check
> check
> node checks/run.js
```

## Summary

```text
git commit
  pre-commit in the global core.hooksPath   gitleaks, then chains to .git/hooks/pre-commit
    .git/hooks/pre-commit                    two lines, written by npm run hooks
      checks/pre-commit.sh                   this checkout's copy, at once:
        gitleaks git --pre-commit --staged
        node checks/run.js --staged          the checks, on the files as staged
```

`AGENTS.md`'s "Run `npm test` and `npm run check` before every commit." becomes "When you start work in a clone, run `npm run hooks` once." A check that fails or cannot run refuses the commit with its fix. Tests stay out of the hook, since `npm test` alone took 3.9 to 4.2 s, and run at the PR head under ADR 0006. ADR 0008 records why; `checks/README.md` says how a factory repo copies the hook.

Survival test: on 2026-11-25 PR 36 (`6397111`) and PR 43 (`192e2f7`) reached CI with `npm run check` failing, so the line was skipped twice and a script can hold it (ADR 0007, criterion 3). The owner picked "A fast pre-commit hook" on 2026-11-26.

## Evidence

- **Before:** a commit that broke `npm run check` went through, and only CI caught it ("AGENTS.md:53:96: pointer without a condition.", PR 43).
  **After:** "a staged em dash makes the hook refuse the commit" in `test/pre-commit.test.js` failed first (`Cannot find module ... checks/install-hook.js`), then passed. Seven more tests cover the staged files over the working tree, a `git add -N` file, gitleaks missing, finding a secret or failing, the installer, and a worktree reached through a global hooks path. Breaking each behavior in a copy turned its test red.
- In a throwaway clone on this machine: a planted em dash was refused through the real global gitleaks hook, and real gitleaks refused a random `ghp_` token without printing it.
- Hook time from git's trace2 events, five commits each: nothing staged 2.25 to 2.62 s, one Markdown file 2.08 to 2.28 s, against 0.96 to 1.06 s for the global gitleaks hook alone. Method and every number: first comment below.

## Merge danger

**Door:** two-way. **Blast radius:** commits. Each clone runs `npm run hooks` once after merge, and a worktree on a branch from before it cannot commit until rebased onto main. On a CRLF checkout one existing test, "a snapshot checked out with CRLF line endings still matches", fails here and on main alike.

