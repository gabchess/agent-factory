const LINEAR = /\blinear\.app\b/gi;
const MESSAGE = "link to Linear. Linear links to this repo, never the reverse. Keep the context here and remove the link.";

const linearLinks = ({ path, text }) =>
  text.split("\n").flatMap((content, index) =>
    [...content.matchAll(LINEAR)].map((match) => ({ path, line: index + 1, column: match.index + 1, message: MESSAGE })),
  );

export const check = ({ files }) => files.flatMap(linearLinks);
