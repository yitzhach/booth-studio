#!/bin/bash
# Usage: tools/main-split/views.sh <log dir> [suite ...]
# Runs each suite on its own, one after another (two at once time out on a
# four-core sandbox), and writes "<suite> <exit status>" per line to
# <log dir>/views.status, then DONE. With no suites: every view suite in
# package.json's test:view, then e2e.
cd "$(dirname "$0")/../.." || exit 1
out=$1
shift
mkdir -p "$out"
export BOOTH_TEST_CHROMIUM=${BOOTH_TEST_CHROMIUM:-/opt/pw-browsers/chromium}
suites=("$@")
if [ ${#suites[@]} -eq 0 ]; then
  mapfile -t suites < <(node -e 'const s=require("./package.json").scripts["test:view"];for(const m of s.matchAll(/tests\/([\w-]+)\.mjs/g))console.log(m[1])')
  suites+=(e2e)
fi
: > "$out/views.status"
for s in "${suites[@]}"; do
  node "tests/$s.mjs" > "$out/v-$s.log" 2>&1
  echo "$s $?" >> "$out/views.status"
done
echo DONE >> "$out/views.status"
