#!/bin/bash
# Booth Studio's cloud-session start (docs/WORKFLOW.md). It installs the npm
# dependencies and points the browser suites at the sandbox's Chromium, so
# every command in CLAUDE.md → Testing runs without setup. Cloud sessions only:
# on a laptop it does nothing.
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
  if timeout 540 npm ci --no-audit --no-fund --loglevel=error >/tmp/booth-studio-npm-ci.log 2>&1; then
    note "npm ci done"
  else
    note "npm ci FAILED (log: /tmp/booth-studio-npm-ci.log), run it by hand before testing"
  fi
else
  note "node_modules up to date"
fi

# A BOOTH_TEST_CHROMIUM the environment already sets is kept; the line is
# written once, however often the session restarts (resume, compact).
chromium=/opt/pw-browsers/chromium
if [ -n "${BOOTH_TEST_CHROMIUM:-}" ]; then
  note "BOOTH_TEST_CHROMIUM=$BOOTH_TEST_CHROMIUM (already set)"
elif [ -x "$chromium" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  grep -qs "BOOTH_TEST_CHROMIUM=" "$CLAUDE_ENV_FILE" || echo "export BOOTH_TEST_CHROMIUM=$chromium" >>"$CLAUDE_ENV_FILE"
  note "BOOTH_TEST_CHROMIUM=$chromium"
elif [ -x "$chromium" ]; then
  note "no CLAUDE_ENV_FILE: prefix browser suites with BOOTH_TEST_CHROMIUM=$chromium"
fi

echo "booth-studio session start: $notes"
exit 0
