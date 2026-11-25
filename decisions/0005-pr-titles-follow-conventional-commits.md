# PR titles follow Conventional Commits, and PRs merge by squash

Every PR merges to `main` as one squash commit whose message is the PR title. The title follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `<type>[(scope)][!]: <description>`. The `pr-title` workflow runs `checks/pr-title.js` on every PR and fails a title that breaks the format. Commits on a PR branch stay free-form, since the squash replaces them.

## Rules

| Type | Use it when the PR |
|---|---|
| `feat` | adds or changes a rule, ADR, check, template, agent or pointer that agents follow |
| `fix` | corrects a check, script or rule that did the wrong thing |
| `docs` | changes prose and no agent does anything differently |
| `refactor` | restructures code or files and keeps their behavior |
| `test` | changes tests or fixtures only |
| `ci` | changes `.github/workflows/` only |
| `build` | changes `package.json` or other build setup |
| `perf` | makes a check or script faster |
| `style` | changes formatting only |
| `chore` | maintains anything else, such as `.gitignore` |
| `revert` | reverts an earlier PR |

- Write the type in lower case. One PR has one type. When two types fit, split the PR.
- The scope is optional: one lower case noun for the area, such as a top-level folder or a check name, as in `fix(checks): skip binary files`.
- Add `!` before the colon when the PR removes or renames something an agent or another repo relies on: a rule, a check, a template section or a linked path.
- Write the description as one line in the imperative that names the change.
- To revert a PR, title the revert `revert: <description of the reverted PR>` and put `Refs: <commit SHA>` in its body. Rename the title GitHub's Revert button writes.
- Check a title before you open the PR: `npm run check:title -- "<title>"`.

## Releases

Agents review and merge PRs under ADR 0006. Nobody bumps a version, writes a tag or edits a changelog by hand. A repo that starts to publish versions adds CI that derives each version from these types: `fix` bumps the patch, `feat` the minor and `!` the major.

## Why

The squash commit is the only message that reaches `main`, so the title is the one string to check. A CI check on it needs no hook on any machine and runs the same for every harness. A typed history lets an agent filter `git log` for rule changes, and release tooling can read it later with no second convention. The cost: every PR needs a type, and a wrong type needs a title edit before merge.

## Considered options

- A `commit-msg` hook or commitlint on every commit: each clone in each harness needs setup, and the squash discards branch commits.
- Long-lived `develop` and `master` branches, staging deploys, GitOps PRs and signed images: these repos deploy nothing.
- Automatic version bumps and a generated changelog: deferred until a repo publishes versions.

## Consequences

- Repository settings allow squash merges only, and the default squash commit message is the PR title and description. With GitHub's default, a PR with one commit lands under that commit's message.
- gabchess/skills follows this ADR. Its `AGENTS.md` points here.

## Evidence

`git log --format=%s main` at `3c73d83` holds 18 commits in three shapes: 3 merge commits such as "Merge pull request #8 from gabchess/devin/gab-806-writing-skill-pointer", 7 squash titles such as "Point AGENTS.md to the gabe-voice skill (#13)", and 8 branch commits that merges brought in. No subject says whether it changed a rule or fixed a typo. `gh api repos/gabchess/agent-factory` shows merge, rebase and squash merges allowed, with `squash_merge_commit_title` set to `COMMIT_OR_PR_TITLE`.
