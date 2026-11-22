const LIMIT = 60;
const ADR = /^decisions\/\d{4}-[^/]+\.md$/;

const lineCount = (text) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

export const check = ({ files }) =>
  files
    .filter(({ path }) => ADR.test(path))
    .map(({ path, text }) => ({ path, lines: lineCount(text) }))
    .filter(({ lines }) => lines > LIMIT)
    .map(({ path, lines }) => ({
      path,
      line: LIMIT + 1,
      message: `ADR has ${lines} lines, over the limit of ${LIMIT}. Split it into two decisions or move the background out.`,
    }));
