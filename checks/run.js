import { gitRepo } from "./repo-files.js";
import * as noDashes from "./no-dashes.js";

const CHECKS = [noDashes];

const format = ({ path, line, column, message }) => `${path}:${line}${column ? `:${column}` : ""}: ${message}`;

const repo = gitRepo();
const failures = CHECKS.flatMap(({ check }) => check(repo));
failures.forEach((failure) => console.error(format(failure)));
process.exitCode = failures.length ? 1 : 0;
