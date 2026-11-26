```text
$ git rev-parse HEAD
0c0bb659fef73c317bc155bd47eec36e6cbd00cd
$ npm test
ℹ tests 47
ℹ pass 47
ℹ fail 0
$ npm run check
> check
> node checks/run.js
```

## Summary

```text
PR body                                            asked for by
  code block: "$ git rev-parse HEAD", its SHA,   ADR 0006, the checks at the head
              "$ npm test" and its output ...
  ## Summary       a diagram, diff or tree          the pr skill
  ## Evidence      **Before:** and **After:**       the pr skill
  ## Merge danger  **Door:** and **Blast radius:**  the pr skill

node checks/run-pr-body.js --head <sha> --command "npm test" --command "npm run check" body.md
  one "PR body: <what is missing>. <the fix>" line per gap, then exit 1
```

`AGENTS.md` gains one line under Writing, for every repo: write the body with the pr skill below the check commands' output at the head, then run `checks/run-pr-body.js` on it. `checks/README.md` says how to run it from any repo's clone, and `.github/workflows/pr-body.yml` runs it on every PR here, as `pr-title.yml` does for titles.

Survival test: the owner asked on 2026-11-26 for the pr skill on every PR "to keep all PRs inside the same bar". Of the 15 latest merged PRs here, 2 bodies name their head SHA, so ADR 0006's quoted checks could not be tied to a head on the other 13 (ADR 0007, criterion 3).

## Evidence

- **Before:** PR 42's body had "## Changes" and "## Verification", no head SHA and no check output, and nothing failed it.
  **After:** `test/pr-body.test.js` failed first (`Cannot find module ... checks/pr-body.js`), then passed. Four bodies pass (either letter case, CRLF, a bot's appended summary, evidence on later lines, `<!--` in inline code) and twelve fail fixtures each give their fix, among them a stale head, an empty template, sections hidden in a comment and a comment inside a line. Breaking each of eleven behaviors in a copy turned a test red.
- This body and the bodies of gabchess/skills PR 77 and agent-factory PR 44 pass `run-pr-body.js` at their heads: first comment below.

## Merge danger

**Door:** two-way. **Blast radius:** PRs. After merge, `pr-body.yml` fails any PR here whose body lacks this shape, open PR 41 included, until the body is rewritten. Each push needs the body's checks and SHA redone.

