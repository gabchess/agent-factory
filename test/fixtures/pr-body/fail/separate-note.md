```text
$ git rev-parse HEAD
1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6
$ npm test
ℹ pass 49
$ npm run check
> node checks/run.js
```

## Summary

```text
checks/pr-body.js
```

## Evidence

- **Before:** a body with no checks' output passes review unnoticed.
  **After:**

The tests pass on CI too.

## Merge Danger

**Door:** two-way

**Blast Radius:** PRs
