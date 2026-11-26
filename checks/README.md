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

The PR body check, which reads a PR body instead of the repo:

- `pr-body.js`: fails a PR body that does not open with a fenced code block of the check commands' output at the head, which ADR 0006 asks for: `$ git rev-parse HEAD` with the SHA it printed, then each command as `$ <command>` with the last lines it printed. It also fails a body that lacks what [the pr skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/pr/SKILL.md) writes, in its order: `## Summary` with a diagram, diff sketch or tree in a code block, `## Evidence` with something after `**Before:**` and after `**After:**`, and `## Merge danger` with `**Door:**` one-way or two-way and `**Blast radius:**`. A comment block, from a line that starts with `<!--` through the line that holds `-->`, does not count, since GitHub hides it. A comment inside a line, outside inline code, fails the body with its line number: put it on lines of its own or delete it. Headings and labels match in any letter case, and other sections, such as the summary a review bot appends, are allowed. Its test reads `test/fixtures/pr-body/`.
- `run-pr-body.js` runs it on the body in a file, or on stdin when no file is named. `--head` is the full SHA the output must name, and each `--command` is a check command it must hold. Before you open or update a PR in any repo, save the body and run this from that repo's checkout, with its check commands: `node <agent-factory clone>/checks/run-pr-body.js --head "$(git rev-parse HEAD)" --command "npm test" --command "npm run check" body.md`. In this repo `npm run check:body --` takes the same arguments. A repo with CI runs it on every PR as `.github/workflows/pr-body.yml` does, with the body and head SHA from the PR event.

The deny list check, which reads a harness's settings instead of the repo:

- `deny-list.js`: fails a Claude Code `settings.json` whose `permissions.deny` lacks a rule from `templates/deny-list/claude-code.json`, and a `templates/deny-list/list.json` entry with no Claude Code mapping. `run-deny-list.js` runs it on the path passed as an argument: `npm run check:deny -- ~/.claude/settings.json`. CI never runs it, since the file lives on each machine. Its test reads `test/fixtures/deny-list/pass/settings.json` and `fail/settings.json`.

The generator, which CI never runs:

- `write-snapshot.js`: writes `data/instructions.snapshot` from the repo as it is now. Run it with `npm run snapshot` after changing an `AGENTS.md`, a `CLAUDE.md`, a skill or an MCP contract.
