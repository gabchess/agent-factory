const FENCE = /^\s*(```|~~~)/;
const maskInlineCode = (line) => line.replace(/`+[^`]*`+/g, (code) => " ".repeat(code.length));

export const isMarkdown = (path) => path.endsWith(".md");

export function proseLines(text) {
  let inFence = false;
  return text.split("\n").flatMap((raw, index) => {
    if (FENCE.test(raw)) {
      inFence = !inFence;
      return [];
    }
    return inFence ? [] : [{ line: index + 1, raw, prose: maskInlineCode(raw) }];
  });
}
