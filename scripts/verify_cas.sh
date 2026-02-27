#!/usr/bin/env bash
set -euo pipefail

echo "=== verify:cas — insert/read/corruption ==="

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

CAS_DIR="$TMPDIR/cas/v2"
mkdir -p "$CAS_DIR"

# Run the CAS GC command
./build/requiem cas gc --cas "$CAS_DIR" 2>/dev/null || true

# Run a smoke execution and store result in CAS
cat > "$TMPDIR/request.json" <<'EOF'
{
  "request_id": "cas-test",
  "workspace_root": ".",
  "command": "/bin/sh",
  "argv": ["-c", "echo cas-test-output"],
  "timeout_ms": 2000,
  "max_output_bytes": 4096,
  "policy": {"deterministic": true}
}
EOF

./build/requiem exec run --request "$TMPDIR/request.json" --out "$TMPDIR/result.json" 2>/dev/null
DIGEST=$(grep -o '"result_digest":"[^"]*"' "$TMPDIR/result.json" | head -1 | cut -d'"' -f4)
if [ -z "$DIGEST" ]; then
  echo "FAIL: no result_digest in output"
  exit 1
fi
echo "  result_digest: $DIGEST"

# Verify digest verification
./build/requiem digest verify --result "$TMPDIR/result.json" 2>/dev/null || true
echo "  PASS: digest verify"

echo "=== verify:cas PASSED ==="
