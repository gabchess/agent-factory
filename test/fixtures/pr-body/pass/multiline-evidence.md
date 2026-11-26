<!-- opened with the pr skill -->
```text
$ git rev-parse HEAD
1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6
$ npm test
ℹ pass 46
$ npm run check
> node checks/run.js
```

## Summary

```text
checks/
└── pr-body.js
```

## Evidence

- **Before:**

  ```text
  ✖ 1 failing
  ```

- **After:**
  ![the passing run](https://example.com/after.png)

## Merge danger

**Door:** two-way

**Blast radius:** PRs
