# CLAUDE.md

This file gives guidance to coding agents working in this repository.

## How to work

- Think carefully and step by step before making any change.
- Read the relevant files fully before editing them.
- Prefer small, focused changes over large rewrites.
- Do not introduce new dependencies; this project uses only the Node.js standard library.
- Keep functions short and give them descriptive names.
- Never leave commented-out code behind.
- If something is unclear, make a reasonable assumption and write it down in your final message.
- Be thorough: double-check your work before you say it is done.

## Code style

- TypeScript only, run directly by Node.js (type stripping): use only erasable syntax, no `enum`, no parameter properties, no namespaces.
- Import local modules with their `.ts` extension.
- Use `const` by default and `let` only when reassigning.
- Use early returns instead of nested conditionals.
- Errors thrown from the decoder start with `partner feed:`.
- Keep the CLI thin: parsing in `src/cli.ts`, logic in `src/orders/`.

## Domain notes

- Orders arrive from the legacy partner feed and are decoded in `src/legacy/decoder.ts`; never read raw feed fields outside the decoder.
- Partner order `amount` values are integers in the currency's minor unit (for example cents for USD); never treat them as whole currency units.
- Currency codes are ISO 4217 and are normalized to upper case by the decoder.
- Order ids are opaque strings; do not parse them.

## Testing

- Every change needs tests. Use `node:test` and `node:assert/strict`.
- Run `npm test` before finishing and make sure everything passes.
- Never skip, disable or delete tests to make the suite pass.
- Put tests in `test/` with the `.test.ts` suffix.

## Communication

- Summarize what you changed and why in your final message.
- Mention any assumptions you made and anything you could not verify.
- Be concise.
