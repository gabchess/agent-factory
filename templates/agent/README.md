# Agent template

Copy `AGENT.md` into `agents/<group>/<agent-name>/`, in the group that mirrors its skills. CI fails when an agent loses a frontmatter key or a section the template has, or puts the sections out of order.

- Name every skill and tool contract the agent uses in "Skills and tools".
- "Won't do" names who handles each boundary.
- Leave the model out. The orchestrator picks it per run from the models the harness offers, and prefers one with recorded results in `data/` when any exist.
- Put a check in code before any model judge. A model judge only warns until it is measured against Gabriel's own picks.
