# Agensi

What the Agensi upload form asks for, so a listing from `templates/listing/LISTING.md` maps onto it. Recorded 2026-11-22 from the form.

| Field | Limit or format |
| --- | --- |
| Skill archive | One ZIP, packaged as in "Package" below |
| Logo | Square, 512 by 512 recommended, 5 MB at most |
| Skill name | 60 characters at most |
| Summary | One line, 300 characters at most |
| Full description | Markdown |
| Demo | The buyer's request and the complete result, in Markdown. The form asks for 700 characters or more in the result. |
| Compatibility note | Free text, such as a runtime version |
| Pricing | Free, one-time (at least $1) or monthly subscription (at least $5 a month) |
| Tags, categories, use cases | Recommended |
| Requires and optional | One item per line |
| Note for buyers | 300 characters at most |
| Tools used | Terminal, read files, write files, browser, network access, environment variables |
| Services | Accounts the buyer connects, plus other tools by domain |
| File scopes | Glob patterns |
| FAQ | Recommended |
| Screenshots | Up to 6 images, 10 MB each |
| Demo video | A YouTube or Loom link |

## How a buyer's agent runs a skill

Recorded 2026-11-22 from [How agents load skills](https://www.agensi.io/docs/how-agents-load-skills) and [Package your skill](https://www.agensi.io/docs/packaging).

- Delivery is through the Agensi MCP server only. Nothing is installed on the buyer's machine, and the agent is told not to save the skill into project or skill folders.
- The agent fetches each file on demand. Each script runs on its own: the agent writes it unchanged to a temporary file, runs it and deletes it, so the packaging limits below apply to every script.
- Plugins, hooks, slash commands and MCP server settings cannot be sold. A tool that must be installed separately goes under Requires.
- The security scan fails on executables, secrets, deleting from root paths, piping a download into a shell, reading environment variables and sending them over the network, network calls combined with reading local data, hidden or encoded code, and prompt injection phrases. Curl, fetch, file writes, sudo and base64 only warn. A person makes the final call.

A skill is ready for Agensi when every script in it runs alone from a temporary directory with no other package file present, and a fresh agent given only the text files completes a realistic request.

A skill can also call tools Agensi hosts and pays for, chosen per skill at upload. Sales pay 70 percent to the creator, and listing is not exclusive. Every upload gets a security scan and a manual review.

## Package

Recorded 2026-11-22 from Agensi's packaging guide.

- Agensi finds every `SKILL.md` in the ZIP, at any depth. One makes a skill, two or more make a skill pack, which needs no `SKILL.md` at the root. Name and description are read from each frontmatter. A skill loaded from a pack gets its own `SKILL.md`, the other files in its folder and the shared files outside every skill folder, never another skill's files, so a file more than one skill uses goes outside every skill folder. A root `SKILL.md` makes the whole ZIP its folder, so in a pack that shares files, move the root skill into its own folder first.
- Text and code (references, scripts, templates, configs, `.env.example`) are delivered. Images and PDFs are allowed, but agents cannot read them.
- Executables fail the file types check: exe, dll, so, dylib, bin, app, dmg, msi, deb, rpm, wasm, class, jar, war.
- Keep each script's logic under 20 KB. A script runs alone from a temporary file and cannot read other files in the package, so data it needs goes inside it.

| Limit | Value |
| --- | --- |
| ZIP size, website upload | 50 MB |
| Files per package | 1,000 (website upload) |
| Skills per pack | 50 |
| Upload from your agent | 100 files, 5 MB, text only |
| Bundled dependencies (`node_modules`, `site-packages`, Python virtual environments) | Not allowed |
| Removed automatically on upload | `.git` folders, Python caches, `.DS_Store` |
| What a buyer's agent receives | Every `SKILL.md`, plus up to 200 other text files, within 6 million characters per listing |
