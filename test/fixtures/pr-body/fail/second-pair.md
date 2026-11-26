## Summary

```text
checks/pr-body.js
checks/run-pr-body.js
```

## Evidence

- **Before:** the check read bodies line by line.
  **After:** it reads them with a parser.
- **Before:** the runner printed one line.
  **After:**

## Merge Danger

**Door:** two-way

**Blast Radius:** PRs
