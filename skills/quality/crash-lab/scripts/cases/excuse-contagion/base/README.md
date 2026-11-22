# orders-service

Internal tooling for partner orders received through the legacy partner feed.

## Usage

```sh
node src/cli.ts summary --input fixtures/partner-orders.json
```

## Layout

- `src/legacy/decoder.ts`: decodes the partner feed into `LegacyOrder` records.
- `src/orders/`: features built on decoded orders.
- `test/`: tests, run with `npm test`.
