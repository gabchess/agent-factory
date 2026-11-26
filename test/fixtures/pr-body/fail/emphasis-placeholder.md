## Summary

```text
checks/pr-body.js
```

## Evidence

- **Before:** a body with no checks' output passes review unnoticed.
  **After:** `npm run check:body` fails it and names the fix.

## Merge Danger

**Door:** two-way

**Blast Radius:** \<one-word *description*>
