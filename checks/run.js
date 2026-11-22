import { gitRepo } from "./repo-files.js";
import * as adrLength from "./adr-length.js";
import * as agentsPointers from "./agents-pointers.js";
import * as deadLinks from "./dead-links.js";
import * as noDashes from "./no-dashes.js";
import * as noLinearLinks from "./no-linear-links.js";
import * as skillNames from "./skill-names.js";

const CHECKS = [adrLength, agentsPointers, deadLinks, noDashes, noLinearLinks, skillNames];

const format = ({ path, line, column, message }) => `${path}:${line}${column ? `:${column}` : ""}: ${message}`;

const repo = gitRepo();
const failures = CHECKS.flatMap(({ check }) => check(repo));
failures.forEach((failure) => console.error(format(failure)));
process.exitCode = failures.length ? 1 : 0;
