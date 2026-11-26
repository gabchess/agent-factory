Local runs at head `07cf09e3ab52717a05815c66a84b3bcda7755b08` (GitHub Actions is out of minutes on this repo). Full output, the audit and the left-out list: https://github.com/example/repo/pull/16#issuecomment-1
```text
python -I -X utf8 -m unittest discover -s tests    Ran 120 tests in 301.106s, OK
python -I -X utf8 -m unittest discover -s checks   Ran 10 tests in 1.085s, OK
python -I -X utf8 checks/run.py                    6 checks, 0 failures
```
Two earlier runs at this head each failed one test when another program wrote a shared folder mid-run. The comment has all four runs.

## Summary
Records the second round of decisions of 2026-01-01, and fixes every stale line the decisions file lists for this repo.
```diff
 decisions/
+0005  accept rule: old against new, blind, one column per measure
+0006  one folder per job the product does
~0004  Superseded by 0005
~GLOSSARY.md  Widget (Avoid: gadget), +Accept rule
```
- Each Evidence line marks the owner's decision or the session agent's call.
- Left out, with reasons in the comment: two options no ADR here decides.

## Evidence
- **Before:** at `4444444`, the glossary called the widget a gadget, and 0004 let a change land on one run.
  **After:** at `07cf09e3ab52717a05815c66a84b3bcda7755b08`, the carry-over audit lists all 12 sentences of 0004 (9 carried, 3 changed, 0 dropped).

## Merge danger
**Door:** two-way. A revert restores every file.

**Blast radius:** docs. `checks/run.py` reads every changed file for the ADR shape, dashes and links, and nothing else reads them.
