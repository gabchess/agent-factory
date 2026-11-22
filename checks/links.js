const LABEL = String.raw`\[(?<label>(?:[^[\]]|\[[^\]]*\])*)\]`;
const DESTINATION = String.raw`\(\s*(?:<(?<angle>[^>]+)>|(?<bare>(?:[^()\s]|\([^()\s]*\))+))(?:\s+[^)]*)?\)`;

export const INLINE_LINK = new RegExp(LABEL + DESTINATION, "dg");
const REFERENCE_LINK = new RegExp(LABEL + String.raw`\[[^\]]*\]`, "g");

export const linkSpans = (prose) =>
  [INLINE_LINK, REFERENCE_LINK].flatMap((pattern) =>
    [...prose.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length })),
  );

export const maskSpans = (text, spans) =>
  spans.reduce((masked, { start, end }) => masked.slice(0, start) + "x".repeat(end - start) + masked.slice(end), text);
