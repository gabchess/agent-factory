const FENCE = /^\s*(`{3,}|~{3,})/;
const INLINE_CODE = /(?<!`)(`+)(?!`)[^]*?(?<!`)\1(?!`)/g;
const maskInlineCode = (line) => line.replace(INLINE_CODE, (code) => "x".repeat(code.length));

export const isMarkdown = (path) => path.endsWith(".md");

const closes = (marker, opener) => marker[0] === opener[0] && marker.length >= opener.length;

export function proseLines(text) {
  let opener = null;
  return text.split("\n").flatMap((raw, index) => {
    const marker = raw.match(FENCE)?.[1];
    if (marker && (!opener || closes(marker, opener))) {
      opener = opener ? null : marker;
      return [];
    }
    return opener ? [] : [{ line: index + 1, raw, prose: maskInlineCode(raw) }];
  });
}
