# Agent template

Copy `AGENT.md` into `agents/<group>/<agent-name>/`, in the group that mirrors its skills. CI fails when an agent loses a frontmatter key or a section the template has, or puts the sections out of order.

- Name every skill and tool contract the agent uses in "Skills and tools". An agent that is not told about a skill rarely loads it.
- "Won't do" names who handles each boundary, so the agent hands work off instead of stopping.
- Leave the model out. The orchestrator picks it per run from the models the harness offers and the results recorded in `data/`.
