# checks

The scripts CI runs against this repo. `run.js` takes one snapshot of the repo from `git-repo.js` and passes it to every check. Each check exports `check(repo)`, a pure function that returns its failures. Each failure names the file, the line and the fix.

Every check has a passing and a failing fixture under `test/fixtures/<check>/` and a test in `test/`. To add one, write its test and fixtures first, then the check, then add it to `run.js`.

Support modules, shared by the checks:

- `git-repo.js`: lists the files git tracks or would track, and skips `test/fixtures/` and binary files.
- `repo.js`: builds the snapshot a check reads, the same way for the real repo and for a fixture.
- `markdown.js`: gives the prose lines of a Markdown file, without code blocks or inline code.
- `lines.js`: finds every match of a pattern, line by line, with its column.
- `frontmatter.js`: reads the keys and values of a Markdown file's frontmatter.
- `artifacts.js`: the one place that says which paths are a skill, agent, ADR, MCP contract, run record or `AGENTS.md`, and which template each kind starts from.
- `links.js`: the one Markdown link grammar, inline and reference-style, with nested labels. Checks that need to know where links are use it instead of their own pattern.

The checks:

- `adr-length.js`: fails on an ADR in `decisions/` over 60 lines.
- `adr-names.js`: fails on a Markdown file in `decisions/` that is not a numbered ADR or the folder's `README.md`, `AGENTS.md` or `CLAUDE.md`.
- `agents-pointers.js`: fails on an `AGENTS.md` pointer to a path that does not exist, and on a pointer whose line does not start with when to read it.
- `audit-verdicts.js`: fails on a verdict table in `data/audit/` whose header is wrong, whose row has a verdict other than delete or rewrite, no reason, a rewrite with no ticket key, a delete with one, or a second row for the same file.
- `dead-links.js`: fails on a Markdown link to a path in the repo that does not exist, including a `https://github.com/gabchess/agent-factory` link on `main`.
- `instruction-snapshot.js`: fails when `data/instructions.snapshot` no longer matches what an agent loads here: every `AGENTS.md` and `CLAUDE.md`, the skill index and the tool contracts.
- `no-dashes.js`: fails on em and en dashes in any text file, and on a hyphen used as a dash in Markdown prose.
- `no-linear-links.js`: fails on a link to Linear in any file. Linear links here, never the reverse.
- `run-records.js`: fails on a row of `data/runs.jsonl` that is not a JSON object, lacks a key or type the `orchestrate-task` gate writes, skips or repeats an attempt, follows a run that already ended, goes over its loop cap, fails a second time in a row or at its loop cap without being blocked, has an impossible or non ISO 8601 time, or is blocked without an ask.
- `skill-names.js`: fails when two skills share a name or a folder name, since harnesses link skills flat by name.
- `template-drift.js`: fails when a skill, agent, ADR or MCP contract loses a frontmatter key or a section its template in `templates/` has, or puts the sections out of order.

The PR title check, which reads a title instead of the repo:

- `pr-title.js`: fails a PR title that breaks the format in `decisions/0005-pr-titles-follow-conventional-commits.md`. `run-pr-title.js` runs it on the title passed as an argument or in `PR_TITLE`, and `.github/workflows/pr-title.yml` runs it on every PR. Its test reads one title per line from `test/fixtures/pr-title/pass.txt` and `fail.txt`.

The generator, which CI never runs:

- `write-snapshot.js`: writes `data/instructions.snapshot` from the repo as it is now. Run it with `npm run snapshot` after changing an `AGENTS.md`, a `CLAUDE.md`, a skill or an MCP contract.
