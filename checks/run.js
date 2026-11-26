import { gitRepo, stagedRepo } from "./git-repo.js";
import * as adrLength from "./adr-length.js";
import * as adrNames from "./adr-names.js";
import * as auditVerdicts from "./audit-verdicts.js";
import * as agentsPointers from "./agents-pointers.js";
import * as deadLinks from "./dead-links.js";
import * as instructionSnapshot from "./instruction-snapshot.js";
import * as noDashes from "./no-dashes.js";
import * as noLinearLinks from "./no-linear-links.js";
import * as runRecords from "./run-records.js";
import * as skillNames from "./skill-names.js";
import * as templateDrift from "./template-drift.js";

const CHECKS = [adrLength, adrNames, auditVerdicts, agentsPointers, deadLinks, instructionSnapshot, noDashes, noLinearLinks, runRecords, skillNames, templateDrift];

const format = ({ path, line, column, message }) => `${path}:${line}${column ? `:${column}` : ""}: ${message}`;

const repo = process.argv.includes("--staged") ? stagedRepo() : gitRepo();
const failures = CHECKS.flatMap(({ check }) => check(repo));
failures.forEach((failure) => console.error(format(failure)));
process.exitCode = failures.length ? 1 : 0;
