#!/bin/sh
# One command for the daily health check: every non-browser suite, then the browser suites (needs: python3 -m http.server 8765 &).
cd "$(dirname "$0")/.." || exit 1
fail=0
run() { printf '%-14s' "$1"; out=$(node tests/$1.js 2>&1 | tail -1); echo "$out" | cut -c1-90; }
printf "%-14s" wasm_diff; node tests/wasm_diff.js 2>&1 | head -1
for t in diff turbo_diff fixit scoring problems neg; do run $t; done
printf '%-14s' randdiff; node tests/randdiff.js 60 "$(date +%j)00" 2>&1 | tail -1
if curl -s -o /dev/null localhost:8765; then for t in ui_layout ui_phone ui_motion ui_format ui_turbo ui_input ui_problem ui_class ui_infinite ui_complete ui_overflow ui_fixit ui_live ui_update; do run $t; done
else echo "browser suites skipped (start: python3 -m http.server 8765 &)"; fi
