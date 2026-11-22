import { ADR, isA } from "./artifacts.js";

const isDecisionsFile = ({ path }) => /^decisions\/.+\.md$/.test(path);
const isFolderDoc = ({ path }) => /^decisions\/(.+\/)?(README|AGENTS|CLAUDE)\.md$/.test(path);

export const check = ({ files }) =>
  files
    .filter((file) => isDecisionsFile(file) && !isFolderDoc(file) && !isA(ADR)(file))
    .map(({ path }) => ({ path, line: 1, message: `not a numbered ADR. Rename it decisions/NNNN-title.md, starting from ${ADR.template}.` }));
