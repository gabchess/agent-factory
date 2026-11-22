import { join, resolve } from "node:path";
import { loadCase } from "../src/experiment-design/case.ts";

export const ROOT = resolve(import.meta.dirname, "..");
export const CASE_DIR = join(ROOT, "cases", "legacy-cents");
export const FIXTURES = join(ROOT, "fixtures", "candidates", "legacy-cents");
export const EXPERIMENT = join(ROOT, "experiments", "legacy-cents.json");
export const loadDemoCase = () => loadCase(CASE_DIR);
