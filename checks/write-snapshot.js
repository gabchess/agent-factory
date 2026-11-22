import { writeFileSync } from "node:fs";
import { gitRepo } from "./git-repo.js";
import { render, SNAPSHOT } from "./instruction-snapshot.js";

const text = render(gitRepo());
if (text === null) console.log("Nothing here loads instructions, so no snapshot is needed.");
else writeFileSync(SNAPSHOT, text);
