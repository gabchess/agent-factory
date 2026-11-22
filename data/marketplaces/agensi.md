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

A skill can also call tools Agensi hosts and pays for, chosen per skill at upload. Sales pay 70 percent to the creator, and listing is not exclusive. Every upload gets a security scan and a manual review.

## Package

Recorded 2026-11-22 from Agensi's packaging guide.

- Agensi finds every `SKILL.md` in the ZIP, at any depth. One makes a skill, two or more make a skill pack, which needs no `SKILL.md` at the root. Name and description are read from each frontmatter.
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
