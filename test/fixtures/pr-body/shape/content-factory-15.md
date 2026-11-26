Local runs at head `000c20e0e9b43b7567a0153e8a950e5a174aef6d` (GitHub Actions is out of minutes on this repo). Full output and the audit tables: https://github.com/example/repo/pull/15#issuecomment-1
```text
python -I -X utf8 -m unittest discover -s tests    Ran 120 tests in 300.123s, OK
python -I -X utf8 -m unittest discover -s checks   Ran 10 tests in 1.163s, OK
python -I -X utf8 checks/run.py                    6 checks, 0 failures
```

## Summary
Records the decisions of 2026-01-01 from the decisions file, so the repo says what is true before code starts.
```diff
 decisions/
~0002  the widget read runs daily, so the title drops "weekly"
+0003  one widget per client, with its allowlist test
+0004  a widget lands only after a blind old against new test
~GLOSSARY.md  +Widget ~Engine
~README.md    decisions list
```
- Each Evidence line says whose each part is: the owner's answer or the session agent's call.
- Deferred, with no ADR here: answer 1 (build order) and answer 2 (caps).

## Evidence
- **Before:** at `3333333`, 0003 sent readers to superseded 0001 for its evidence.
  **After:** at `000c20e0e9b43b7567a0153e8a950e5a174aef6d`, the carry-over audit prints `failures=0` and the quote check prints `missing=0`.

## Merge danger
**Door:** two-way. A revert restores every file.

**Blast radius:** docs. `checks/run.py` reads every changed file for the ADR shape, dashes and links, and nothing else reads them.
