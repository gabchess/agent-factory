import { check } from "./pr-title.js";

const title = process.argv[2] ?? process.env.PR_TITLE;
if (title === undefined) {
  console.error('Pass the PR title: npm run check:title -- "<title>", or set PR_TITLE.');
  process.exitCode = 2;
} else {
  const failures = check(title);
  failures.forEach((failure) => console.error(`PR title "${title}": ${failure}`));
  process.exitCode = failures.length ? 1 : 0;
}
