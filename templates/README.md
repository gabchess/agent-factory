# templates

Every new artifact starts from its template. Each folder holds the template and a `README.md` with the bar it must meet.

| Template | Fill it into | CI checks filled copies |
| --- | --- | --- |
| `skill/SKILL.md` | `skills/<bucket>/<name>/SKILL.md` in [gabchess/skills](https://github.com/gabchess/skills) | yes, there |
| `agent/AGENT.md` | `agents/<group>/<name>/AGENT.md` | yes |
| `adr/0000-title.md` | `decisions/NNNN-<title>.md` | yes |
| `mcp-contract/CONTRACT.md` | `tools/<group>/<name>/CONTRACT.md` | yes |
| `prompt/lane-brief.md` | the task, outside this repo | no |
| `handover/HANDOVER.md` | the task, outside this repo | no |

A checked copy must keep every frontmatter key and every `##` section of its template, in the template's order. Extra keys and sections are fine. To change the shape, change the template, and every copy follows it in the same PR.
