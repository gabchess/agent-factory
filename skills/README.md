# skills

Skills live in [gabchess/skills](https://github.com/gabchess/skills), grouped by outcome. Add new ones there.

To install them, run `npx skills@latest add gabchess/skills`, or clone it and run `npm run link`. If you linked skills from an older clone of this repo, run `npm run link` in gabchess/skills again: those links to `crash-lab` and `agentic-dead-rules-detector` point at folders this repo no longer has.

This repo keeps only the template every skill starts from: [`templates/skill/`](../templates/skill/). The skills repo copies it and its CI fails when the copy drifts from this one.
