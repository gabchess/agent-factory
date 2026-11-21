# checks

Scripts that CI runs against this repo. Each one exports a pure function that the tests in `test/` cover with a passing and a failing fixture, and runs on the repo when called directly. A failure names the file, the line and the fix.

- `no-dashes.js`: fails on em and en dashes in text files.
