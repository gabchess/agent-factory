# checks

The scripts CI runs against this repo. `run.js` lists the files git tracks or would track once, skips `test/fixtures/` and binary files, and passes that snapshot to every check. Each check exports `check(repo)`, a pure function that returns its failures. Each failure names the file, the line and the fix.

Every check has a passing and a failing fixture under `test/fixtures/<check>/` and a test in `test/`. To add one, write its test and fixtures first, then the check, then add it to `run.js`.

- `adr-length.js`: fails on an ADR in `decisions/` over 60 lines.
- `agents-pointers.js`: fails on an `AGENTS.md` pointer to a path that does not exist, and on a pointer whose line does not start with when to read it.
- `dead-links.js`: fails on a Markdown link to a path in the repo that does not exist.
- `no-dashes.js`: fails on em and en dashes in any text file, and on a hyphen used as a dash in Markdown prose.
- `no-linear-links.js`: fails on a link to Linear in any file. Linear links here, never the reverse.
- `skill-names.js`: fails when two skills share a name or a folder name, since harnesses link skills flat by name.
