Checks at head `d5dd1204ce5a1edb37ec52fb7a553b5a35adf1a0`, run from the repo root with no list variable set:
```text
$ python -I -X utf8 -m unittest discover -s tests
Ran 3 tests in 1.190s
OK
$ python -I -X utf8 -m unittest discover -s checks
Ran 12 tests in 0.020s
OK
$ python -I -X utf8 checks/run.py
6 checks, 0 failures
```

The name check moved to its own pull request after two review rounds failed on it.

## Summary

The skeleton of a widget factory: seven decisions, the glossary, the working notes and six docs checks.

```diff
 checks/
-  names.py, its test and its fixtures
+  run.py, repo.py and tests/test_run.py, as the source repo has them
 decisions/0004
-  `checks/names.py` fails on any name from a list kept outside the repo.
+  No check enforces the rule yet.
```

## Evidence

- **Before:** at `5555555`, with no list: `0 checks ran`, exit 1.
  **After:** at `6666666`, with no list: `6 checks, 0 failures`, exit 0.
- A separate script read every path on this branch against the list: 0 hits.

## Merge danger

**Door:** two-way. Python checks and docs only.

**Blast radius:** contributors. Until the name check merges, the rule in `AGENTS.md` stands alone.
