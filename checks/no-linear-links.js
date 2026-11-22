import { matchesByLine, textLines } from "./lines.js";

const LINEAR = /\blinear\.app\b/gi;
const MESSAGE = "link to Linear. Linear links to this repo, never the reverse. Keep the context here and remove the link.";

const linearLinks = ({ path, text }) =>
  matchesByLine(textLines(text), LINEAR).map(({ line, column }) => ({ path, line, column, message: MESSAGE }));

export const check = ({ files }) => files.flatMap(linearLinks);
