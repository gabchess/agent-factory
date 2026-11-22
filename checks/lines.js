export const textLines = (text) => text.split("\n").map((raw, index) => ({ line: index + 1, raw, prose: raw }));

export const matchesByLine = (lines, pattern, field = "prose") =>
  lines.flatMap((entry) => [...entry[field].matchAll(pattern)].map((match) => ({ ...entry, match, column: match.index + 1 })));
