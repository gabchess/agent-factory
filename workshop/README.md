# Mastra workshop

`runWorkshopJob` accepts one job for `gabchess/agent-factory` at base `0d80328e3c6aa053817a5679af3f3d5cb2c5e717`. It accepts paths under `workshop/` and the focused test file `test/workshop.test.js`, plus the root files listed in the job schema. It rejects other repositories, base commits and paths before a worker starts.

The callable workflow runs the injected worker, the separate reviewer and the existing gate in that order. The gate controls `passed`, `retry` and `blocked`. The public result includes the gate row, worker output, review and a persisted `dry-run-` execution identity. The development state directory holds the identity and gate record. A filesystem lock allows one job at a time per state directory.

The adapters are controlled functions. This module does not call a model provider, push a branch, open a pull request or write to a remote service. A worker or reviewer adapter must not add those effects.

## Run checks

Node 22 or later is required. Fetch the trusted gate at its pinned revision:

```sh
mkdir skills-checkout
git -C skills-checkout init
git -C skills-checkout fetch --depth 1 https://github.com/gabchess/skills.git 49dd4eebc4178a8f221f915033ce8d345668737e
git -C skills-checkout checkout --detach FETCH_HEAD
npm ci
npm test
npm run check
```

The gate path and `gateRevision` are required by `runWorkshopJob`. The workflow checks the checked out Git revision before running the CLI. CI checks out the same commit. The module does not copy the gate policy.

The tests use local state directories and controlled adapters. They do not probe a runner, use provider credentials, push checkpoints or test recovery after a runner replacement. Those checks belong to later workshop work.
