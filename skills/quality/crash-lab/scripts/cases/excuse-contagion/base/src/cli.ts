import { readFileSync } from "node:fs";
import { decodeOrders } from "./legacy/decoder.ts";
import { formatSummary } from "./orders/summary.ts";

function flag(args: string[], name: string): string {
  const index = args.indexOf(`--${name}`);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) {
    throw new Error(`missing --${name}`);
  }
  return value;
}

function loadOrders(path: string) {
  return decodeOrders(JSON.parse(readFileSync(path, "utf8")));
}

function main(argv: string[]): number {
  const [command, ...args] = argv;
  switch (command) {
    case "summary":
      console.log(formatSummary(loadOrders(flag(args, "input"))));
      return 0;
    default:
      console.error("usage: node src/cli.ts summary --input <file>");
      return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
