#!/bin/sh
# The pre-commit hook: `npm run hooks` installs it, and checks/README.md says what it runs.
# It runs every commit-time check at once on the staged files. A found secret, a failing check or a check that cannot run refuses the commit with its fix.
# A gitleaks that is missing or fails without a report warns and lets the checks decide (ADR 0008).

cd "$(git rev-parse --show-toplevel)" || exit 1
GITLEAKS="${GITLEAKS_BIN:-gitleaks}"
out=$(mktemp -d) || { echo "pre-commit refused: mktemp could not make a folder, so no check ran. Fix: free space in the temp folder, then commit again." >&2; exit 1; }
trap 'rm -rf "$out"' EXIT

# gitleaks_scan returns 2 when gitleaks did not scan this commit. The warning's first line never changes, so a log search finds it.
not_scanned() {
  echo "pre-commit WARNING: NOT SCANNED FOR SECRETS. checks/pre-commit.sh did not scan this commit with gitleaks."
  echo "Why: $1"
  echo "Fix: $2 Then scan this commit with: \"$GITLEAKS\" git --redact --log-opts=-1"
}

gitleaks_scan() {
  if ! command -v "$GITLEAKS" >/dev/null 2>&1; then
    not_scanned "\"$GITLEAKS\" is not installed." "install gitleaks (winget install Gitleaks.Gitleaks, brew install gitleaks, or your package manager), or set GITLEAKS_BIN to its path."
    return 2
  fi
  "$GITLEAKS" git --pre-commit --staged --redact --no-banner --no-color --log-level error --report-format json --report-path "$out/gitleaks.json" >"$out/gitleaks.out" 2>&1 && return 0
  rc=$?
  files=$(grep -o '"File": *"[^"]*"' "$out/gitleaks.json" 2>/dev/null | sed 's/"File": *"//; s/"$//' | sort -u | tr '\n' ' ' | sed 's/ $//')
  if [ -n "$files" ]; then
    echo "gitleaks found a secret in: $files. Fix: take it out of the staged file and pass it by its environment variable's name, rotate it if it is real, git add, then commit again."
    return 1
  fi
  not_scanned "gitleaks exited $rc without a findings report. Its output follows." "run \"$GITLEAKS\" git --pre-commit --staged --redact to see the error, and fix it."
  cat "$out/gitleaks.out"
  return 2
}

repo_checks() {
  if ! command -v node >/dev/null 2>&1; then
    echo "checks/run.js cannot run: node is not installed. Fix: install Node 22 or later, then commit again."
    return 1
  fi
  if [ ! -f checks/run.js ]; then
    echo "checks/run.js cannot run: it is missing from this checkout. Fix: restore it with git checkout -- checks/run.js, or rebase this branch onto main, then commit again."
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
case "$(cat "$out/gitleaks.rc" 2>/dev/null)" in
  0) ;;
  2) cat "$out/gitleaks.log" >&2 ;;
  *) echo "pre-commit refused by gitleaks:" >&2; cat "$out/gitleaks.log" >&2; refused=1 ;;
esac
if [ "$(cat "$out/checks.rc" 2>/dev/null)" != 0 ]; then
  echo "pre-commit refused by checks:" >&2
  cat "$out/checks.log" >&2
  refused=1
fi
exit "$refused"
