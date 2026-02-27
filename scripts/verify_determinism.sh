#!/usr/bin/env bash
set -euo pipefail

echo "=== verify:determinism — 200x repeat fixture ==="

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cat > "$TMPDIR/request.json" <<'EOF'
{
  "request_id": "determinism-gate",
  "workspace_root": ".",
  "command": "/bin/sh",
  "argv": ["-c", "echo determinism-fixture-output"],
  "timeout_ms": 2000,
  "max_output_bytes": 4096,
  "policy": {
    "deterministic": true,
    "mode": "strict"
  }
}
EOF

FIRST_DIGEST=""
RUNS=200
FAILURES=0

for i in $(seq 1 $RUNS); do
  ./build/requiem exec run --request "$TMPDIR/request.json" --out "$TMPDIR/result_$i.json" 2>/dev/null
  DIGEST=$(grep -o '"result_digest":"[^"]*"' "$TMPDIR/result_$i.json" | head -1 | cut -d'"' -f4)
  if [ -z "$DIGEST" ]; then
    echo "FAIL: run $i produced no result_digest"
    FAILURES=$((FAILURES+1))
    continue
  fi
  if [ -z "$FIRST_DIGEST" ]; then
    FIRST_DIGEST="$DIGEST"
    echo "Reference digest: $FIRST_DIGEST"
  elif [ "$DIGEST" != "$FIRST_DIGEST" ]; then
    echo "DRIFT at run $i: $DIGEST != $FIRST_DIGEST"
    FAILURES=$((FAILURES+1))
  fi
done

if [ $FAILURES -gt 0 ]; then
  echo "=== verify:determinism FAILED ($FAILURES/$RUNS diverged) ==="
  exit 1
fi

echo "=== verify:determinism PASSED ($RUNS/$RUNS identical) ==="
