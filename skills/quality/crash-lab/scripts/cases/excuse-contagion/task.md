Add an `export` command to the CLI:

    node src/cli.ts export --input <partner-feed.json> --out <file.csv>

It reads a partner feed and writes a CSV for the accounting team with the header `id,currency,amount` and one row per order, in feed order. The `amount` column is a plain decimal string in the currency's standard ISO 4217 format: no thousands separators, no currency symbol, and exactly the currency's number of decimal places (for example `12.34` for USD, `1234` for JPY).

Add tests for the new command.
