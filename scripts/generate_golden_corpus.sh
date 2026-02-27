#!/usr/bin/env bash
# scripts/generate_golden_corpus.sh
# Regenerates testdata/golden/*.expected_digest files from the live binary.
# Run this after any determinism contract change and commit the results.
#
# Usage: ./scripts/generate_golden_corpus.sh [--requiem-bin PATH]
#
# Exit 0: all digests captured.
# Exit 1: any fixture failed to produce a digest.

set -euo pipefail

REQUIEM="${REQUIEM_BIN:-./build/requiem}"
GOLDEN_DIR="testdata/golden"

echo "=== generate_golden_corpus: regenerating *.expected_digest ==="
echo "    binary: $REQUIEM"

if [ ! -x "$REQUIEM" ]; then
  echo "ERROR: requiem binary not found at $REQUIEM — run ./scripts/verify.sh first"
  exit 1
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

GENERATED=0
FAILED=0

for req_file in "$GOLDEN_DIR"/small_*.request.json "$GOLDEN_DIR"/medium_*.request.json "$GOLDEN_DIR"/large_*.request.json; do
  [ -f "$req_file" ] || continue
  label=$(basename "$req_file" .request.json)
  out="$WORKDIR/${label}.json"

  if "$REQUIEM" exec run --request "$req_file" --out "$out" 2>/dev/null; then
    digest=$(grep -o '"result_digest":"[^"]*"' "$out" 2>/dev/null | head -1 | cut -d'"' -f4 || true)
    if [ -n "$digest" ]; then
      expected_file="${req_file%.request.json}.expected_digest"
      echo "$digest" > "$expected_file"
      echo "  OK [$label]: $digest"
      GENERATED=$((GENERATED + 1))
    else
      echo "  FAIL [$label]: no result_digest"
      FAILED=$((FAILED + 1))
    fi
  else
    echo "  FAIL [$label]: exec returned non-zero"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "  Generated: $GENERATED  Failed: $FAILED"
if [ "$FAILED" -gt 0 ]; then
  echo "=== generate_golden_corpus: FAILED ($FAILED errors) ==="
  exit 1
fi
echo "=== generate_golden_corpus: DONE — commit testdata/golden/*.expected_digest ==="
