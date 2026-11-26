## Summary

```text
checks/pr-body.js
```

## Evidence

- **Before:** a body with no checks' output passes review unnoticed.
  **After:** at 1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6:

  ```text
  $ npm test -- --test-name-pattern smoke
  $ npm run check
  > node checks/run.js
  npm test --watch ok
  ```

## Merge Danger

**Door:** two-way

**Blast Radius:** PRs
