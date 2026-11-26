## Summary

<div>Latency < 50 ms after the change: <img src="https://example.com/latency.png" alt="latency"></div>

## Evidence

- **Before:** the check read every `<` as a tag.
  **After:** at 1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6:

  <p>p < 0.05, see <a title="x>y" href="https://example.com">the run</a></p>

  ```text
  $ npm test
  ℹ pass 49
  $ npm run check
  > node checks/run.js
  ```

## Merge Danger

**Door:** two-way

**Blast Radius:** PRs
