## Summary <!-- drafted with the pr skill -->

```text
pending --> complete
```

## Evidence

- **Before:** the state moved from pending --> complete with no record.
  **After:** each move is logged at the head:

  ```text
  $ git rev-parse HEAD
  1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6
  $ npm test
  ℹ pass 49
  $ npm run check
  > node checks/run.js
  ```

## Merge Danger

**Door:** two-way

The state moves from pending --> complete, and a revert moves it back.

**Blast Radius:** logs
