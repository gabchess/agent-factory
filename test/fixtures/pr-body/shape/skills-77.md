```text
$ git rev-parse HEAD
d9322383f33d488049682c5d3dd92fc5ffa4c512
$ npm ci
added 35 packages, and audited 36 packages in 2s
found 0 vulnerabilities
$ npm test
ℹ tests 120
ℹ pass 120
ℹ fail 0
$ npm run check
> check
> node checks/run.js
```

## Summary

A widget review now ends with the parts it wanted and could not find, so the owner sees which part to add next.

```diff
 3. Read the widget   + list each missing part, with where it looked, or "none"
 4. Recheck           + drop a missing part the parts list holds
 Output: 2. Parts
+        3. Missing parts (part, line, where it looked)
-        3. Dropped findings
+        4. Dropped findings
```

`evals/evals.json` holds the first eval, and `data/receipts/widget-review.json` the receipt. Survival test: the owner picked "A review also lists missing parts" on 2026-01-01.

## Evidence

- **Before:** eval 1 on the skill at `1111111` (main) gave Parts and Dropped findings, and the missing parts sat among judgment calls.
  **After:** eval 1 on `2222222` added section 3, Missing parts: three parts with their line and where the reviewer looked.
- All trials: headless runs beside a synthetic repo. Records: the first comment below.

## Merge danger

**Door:** two-way. **Blast radius:** reviews. The reviewer definitions keep their own report sections.
