# skills

Skills live in [gabchess/skills](https://github.com/gabchess/skills), grouped by outcome. Add new ones there.

To install them, run `npx skills@latest add gabchess/skills`, or clone it and run `npm run link`. Run it again after pulling this change: links made from this repo to `crash-lab` and `agentic-dead-rules-detector` now point at deleted folders.

This repo keeps only the template every skill starts from: [`templates/skill/`](../templates/skill/). The skills repo copies it and its CI fails when the copy drifts from this one.
