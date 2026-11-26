#!/bin/sh
# The pre-commit hook: `npm run hooks` installs it, and checks/README.md says what it runs.
# It runs every commit-time check at once on the staged files. A check that fails, or cannot run, refuses the commit with its fix.

cd "$(git rev-parse --show-toplevel)" || exit 1
GITLEAKS="${GITLEAKS_BIN:-gitleaks}"
out=$(mktemp -d) || { echo "pre-commit refused: mktemp could not make a folder, so no check ran. Fix: free space in the temp folder, then commit again." >&2; exit 1; }
trap 'rm -rf "$out"' EXIT

gitleaks_scan() {
  if ! command -v "$GITLEAKS" >/dev/null 2>&1; then
    echo "gitleaks cannot run: \"$GITLEAKS\" is not installed. Fix: install gitleaks (winget install Gitleaks.Gitleaks, brew install gitleaks, or your package manager), or set GITLEAKS_BIN to its path, then commit again."
    return 1
  fi
  "$GITLEAKS" git --pre-commit --staged --redact --no-banner --no-color --log-level error --report-format json --report-path "$out/gitleaks.json" && return 0
  rc=$?
  files=$(grep -o '"File": *"[^"]*"' "$out/gitleaks.json" 2>/dev/null | sed 's/"File": *"//; s/"$//' | sort -u | tr '\n' ' ' | sed 's/ $//')
  if [ -n "$files" ]; then
    echo "gitleaks found a secret in: $files. Fix: take it out of the staged file and pass it by its environment variable's name, rotate it if it is real, git add, then commit again."
  else
    echo "gitleaks failed with exit $rc and wrote no report, so the staged files were not scanned. Fix the error above, which \"$GITLEAKS git --pre-commit --staged --redact\" prints again, then commit again."
  fi
  return 1
}

repo_checks() {
  if ! command -v node >/dev/null 2>&1; then
    echo "checks/run.js cannot run: node is not installed. Fix: install Node 22 or later, then commit again."
    return 1
  fi
  node checks/run.js --staged
}

run() {
  "$2" >"$out/$1.log" 2>&1
  echo $? >"$out/$1.rc"
}

run gitleaks gitleaks_scan &
run checks repo_checks &
wait

refused=0
for name in gitleaks checks; do
  if [ "$(cat "$out/$name.rc" 2>/dev/null)" != 0 ]; then
    echo "pre-commit refused by $name:" >&2
    cat "$out/$name.log" >&2
    refused=1
  fi
done
exit "$refused"
