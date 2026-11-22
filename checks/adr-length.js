import { ADR, isA } from "./artifacts.js";

const LIMIT = 60;

const lineCount = (text) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

export const check = ({ files }) =>
  files
    .filter(isA(ADR))
    .map(({ path, text }) => ({ path, lines: lineCount(text) }))
    .filter(({ lines }) => lines > LIMIT)
    .map(({ path, lines }) => ({
      path,
      line: LIMIT + 1,
      message: `ADR has ${lines} lines, over the limit of ${LIMIT}. Split it into two decisions or move the background out.`,
    }));
