import { posix } from "node:path";
import { ADR, isA } from "./artifacts.js";

const isDecisionsFile = ({ path }) => /^decisions\/.+\.md$/i.test(path);
const isFolderDoc = ({ path }) => /^decisions\/(.+\/)?(README|AGENTS|CLAUDE)\.md$/.test(path);
const number = ({ path }) => posix.basename(path).slice(0, 4);

const misnamed = (files) =>
  files
    .filter((file) => isDecisionsFile(file) && !isFolderDoc(file) && !isA(ADR)(file))
    .map(({ path }) => ({ path, line: 1, message: `not a numbered ADR. Rename it decisions/NNNN-title.md, starting from ${ADR.template}.` }));

const duplicates = (files) =>
  [...Map.groupBy(files.filter(isA(ADR)), number).values()]
    .filter((adrs) => adrs.length > 1)
    .flatMap((adrs) =>
      adrs.map(({ path }) => ({
        path,
        line: 1,
        message: `ADR number ${number({ path })} is also used by ${adrs.filter((other) => other.path !== path).map((other) => other.path).join(", ")}. Give it the next free number.`,
      })),
    );

export const check = ({ files }) => [...misnamed(files), ...duplicates(files)].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
