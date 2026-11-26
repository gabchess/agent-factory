## Summary

```text
checks/pr-body.js
```

## Evidence

- **Before:**

  <div><img src=https://example.com/plot.png?raw=true></div>

  **After:** the checks pass:

  <div><a href=https://example.com/run?sha=1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6>See the run</a></div>

  ```text
  $ npm test
  ℹ pass 49
  $ npm run check
  > node checks/run.js
  ```

## Merge Danger

**Door:** two-way

**Blast Radius:** PRs
