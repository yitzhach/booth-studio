#!/bin/bash
# Booth Studio's cloud-session start (docs/WORKFLOW.md). It installs the npm
# dependencies, so every command in CLAUDE.md → Testing runs without setup,
# and says which Chromium the browser suites will use. Cloud sessions only:
# on a laptop it does nothing.
#
# A session started above this repository (several repositories at once, in
# /home/user) does not run it: run it by hand from the repository,
# `CLAUDE_CODE_REMOTE=true .claude/hooks/session-start.sh`.
#
# `npm ci` runs only when node_modules is missing or older than the lockfile.
# A cloud container keeps its state after this hook, so the next session
# usually skips the install; `npm ci` (never `npm install`) because it cannot
# rewrite package-lock.json and leave the tree dirty.
#
# Whatever happens, the session starts: a failed install is reported in one
# line (it reaches the session as context) and the hook still exits 0. A cold
# `npm ci` (wrangler, Playwright, Vite, three) can outlast the default hook
# timeout, so .claude/settings.json gives the hook ten minutes and the install
# itself nine, which leaves the hook time to report a stalled install. One cut
# short leaves no node_modules/.package-lock.json, so the next session runs it
# again.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# The repository is two levels above this file, wherever the session started.
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo" || exit 0

# The pinned Playwright must not fetch its own browser (CLAUDE.md → Testing).
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

notes=""
note() { notes="${notes:+$notes; }$1"; }
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  # GNU timeout signals npm's whole process group, install scripts included.
  timeout 540 npm ci --no-audit --no-fund --loglevel=error >/tmp/booth-studio-npm-ci.log 2>&1
  status=$?
  if [ "$status" -eq 0 ]; then
    note "npm ci done"
  elif [ "$status" -eq 124 ]; then
    note "npm ci STALLED and was stopped after 9 minutes (log: /tmp/booth-studio-npm-ci.log); run it by hand before testing"
  else
    note "npm ci FAILED, exit $status (log: /tmp/booth-studio-npm-ci.log); run it by hand before testing"
  fi
else
  note "node_modules up to date"
fi

# The suites pick their browser themselves (tests/helpers/chromium.mjs):
# BOOTH_TEST_CHROMIUM if set, else the pinned Playwright's own Chromium, else
# the sandbox's /opt/pw-browsers/chromium. This only says which, by asking it.
if [ -d node_modules/@playwright/test ]; then
  browser=$(node --input-type=module -e '
    import { chromiumOptions } from "./tests/helpers/chromium.mjs";
    process.stdout.write(chromiumOptions().executablePath || "the pinned Playwright'"'"'s own Chromium");' 2>&1)
  note "browser suites use ${browser:-an unknown Chromium}"
fi

echo "booth-studio session start: $notes"
exit 0
