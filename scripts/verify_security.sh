#!/usr/bin/env bash
set -euo pipefail

echo "=== verify:security — escape, traversal, env hijack ==="

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Test 1: Path traversal must be blocked
cat > "$TMPDIR/escape.json" <<'EOF'
{
  "request_id": "escape-test",
  "workspace_root": "/tmp",
  "command": "/bin/sh",
  "argv": ["-c", "echo nope"],
  "cwd": "../../etc",
  "policy": {"deterministic": true}
}
EOF

RESULT=$(./build/requiem exec run --request "$TMPDIR/escape.json" --out "$TMPDIR/escape_result.json" 2>&1 || true)
if grep -q '"error_code":"path_escape"' "$TMPDIR/escape_result.json" 2>/dev/null; then
  echo "  PASS: path traversal blocked"
else
  echo "  FAIL: path traversal NOT blocked"
  exit 1
fi

# Test 2: Request ID sanitization
cat > "$TMPDIR/sanitize.json" <<'EOF'
{
  "request_id": "../../../etc/passwd",
  "workspace_root": "/tmp",
  "command": "/bin/sh",
  "argv": ["-c", "echo ok"],
  "policy": {"deterministic": true}
}
EOF

./build/requiem exec run --request "$TMPDIR/sanitize.json" --out "$TMPDIR/sanitize_result.json" 2>/dev/null || true
if grep -q '\.\./' "$TMPDIR/sanitize_result.json" 2>/dev/null; then
  echo "  FAIL: unsanitized request_id in output"
  exit 1
else
  echo "  PASS: request_id sanitized"
fi

# Test 3: FORCE_RUST honored
if FORCE_RUST=1 ./build/requiem health 2>/dev/null; then
  echo "  FAIL: FORCE_RUST=1 did not block execution"
  exit 1
else
  echo "  PASS: FORCE_RUST=1 honored"
fi

echo "=== verify:security PASSED ==="
