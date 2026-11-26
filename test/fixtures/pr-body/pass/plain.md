```text
$ git rev-parse HEAD
1f0e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6
$ npm test
ℹ pass 49
ℹ fail 0
$ npm run check
> check
> node checks/run.js
```

## Summary

```diff
 checks/
+├── pr-body.js       # fails a body that lacks the pr skill's sections
+└── run-pr-body.js   # runs it on a file or stdin
```

## Evidence

- **Before:** a body with no checks' output passes review unnoticed.
  **After:** `npm run check:body` fails it and names the fix.

## Merge danger

**Door:** two-way

One revert PR undoes it.

**Blast radius:** PRs
