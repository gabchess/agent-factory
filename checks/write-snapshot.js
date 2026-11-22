import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gitRepo } from "./git-repo.js";
import { render, SNAPSHOT } from "./instruction-snapshot.js";

const text = render(gitRepo());
if (text !== null) {
  mkdirSync(dirname(SNAPSHOT), { recursive: true });
  writeFileSync(SNAPSHOT, text);
}
