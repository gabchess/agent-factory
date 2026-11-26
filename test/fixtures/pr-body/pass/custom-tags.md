## Summary

```text
checks/pr-body.js
```

## Evidence

- **Before:** a body with no checks' output passes review unnoticed.
  **After:** head 1f0e2d3c4b5a6978<p-x>8796a5b4c3d2e1f0a9b8c7d6</p-x><br>Checks:

  ```text
  $ npm test
  ℹ pass 49
  $ npm run check
  > node checks/run.js
  ```

## Merge Danger

**Door:** two-way<br>Back out by reverting.

**Blast Radius:** <b>PRs</b>
