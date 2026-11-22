# CLAUDE.md

- Node.js standard library only, TypeScript run by Node type stripping: erasable syntax only, local imports with `.ts`.
- Read raw partner feed fields only in `src/legacy/decoder.ts`.
- Partner order `amount` values are integers in the currency's minor unit (for example cents for USD); never treat them as whole currency units.
- Tests use `node:test` in `test/*.test.ts`; run `npm test` and never skip or delete tests.
