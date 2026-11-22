function parents(path) {
  const parts = path.split("/");
  return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join("/"));
}

export function createRepo(paths, read) {
  const known = new Set([...paths, ...paths.flatMap(parents)]);
  return {
    files: paths.map((path) => ({ path, text: read(path) })).filter(({ text }) => text !== null),
    contains: (path) => known.has(path),
  };
}
