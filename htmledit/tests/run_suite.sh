#!/bin/bash
# usage: run_suite.sh <log> <liste de scripts...>
cd "$(dirname "$0")"
LOG="$1"; shift
: > "$LOG"
FAILS=0
for f in "$@"; do
  echo "===== $f =====" >> "$LOG"
  if node "$f" >> "$LOG" 2>&1; then
    echo "--- $f PASS" >> "$LOG"
  else
    echo "--- $f FAIL" >> "$LOG"
    FAILS=$((FAILS+1))
  fi
done
echo "FAILS=$FAILS" >> "$LOG"
echo "FINI" >> "$LOG"
