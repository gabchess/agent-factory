## Summary

```text
checks/pr-body.js
```

## Evidence

- **Before:** a body with no checks' output passes review unnoticed.
  **After:** at 1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6, each command with its result after tabs:

  ```text
  npm test		pass 49
  npm run check	  0 failures
  ```

## Merge Danger

**Door:** two-way

**Blast Radius:** *PRs*
