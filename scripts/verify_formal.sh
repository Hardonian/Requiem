#!/usr/bin/env bash
# scripts/verify_formal.sh — Formal specification model checking gate.
#
# Validates:
#   1. All .tla spec files are present and syntactically valid.
#   2. Runs the Python bounded model checker for all specs.
#   3. If TLC (TLA+ model checker) is installed, runs it on each spec.
#   4. Reports which invariants were verified.
#
# Exit 0: all formal invariants verified.
# Exit 1: violation detected or spec missing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FORMAL_DIR="${REPO_ROOT}/formal"

echo "=== verify:formal ==="
VIOLATIONS=0

# ---------------------------------------------------------------------------
# 1. Verify spec files exist
# ---------------------------------------------------------------------------
REQUIRED_SPECS=(
  "CAS.tla"
  "Protocol.tla"
  "Replay.tla"
  "Determinism.tla"
  "model_checker.py"
  "README.md"
)

for spec in "${REQUIRED_SPECS[@]}"; do
  if [ ! -f "${FORMAL_DIR}/${spec}" ]; then
    echo "  FAIL [formal/specs]: ${spec} not found in formal/"
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    echo "  OK  [formal/specs]: ${spec} exists"
  fi
done

[ "$VIOLATIONS" -gt 0 ] && { echo "=== verify:formal FAILED (missing specs) ==="; exit 1; }

# ---------------------------------------------------------------------------
# 2. Validate TLA+ syntax (basic check: MODULE declaration present)
# ---------------------------------------------------------------------------
for tla in "${FORMAL_DIR}"/*.tla; do
  name=$(basename "$tla")
  if ! grep -q "^-* MODULE " "$tla" 2>/dev/null; then
    echo "  FAIL [formal/syntax]: ${name} missing MODULE declaration"
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    echo "  OK  [formal/syntax]: ${name} has MODULE declaration"
  fi
  if ! grep -q "THEOREM Spec =>" "$tla" 2>/dev/null; then
    echo "  WARN [formal/theorem]: ${name} has no THEOREM statement — add THEOREM Spec => [](...)"
  fi
done

# ---------------------------------------------------------------------------
# 3. Run Python bounded model checker
# ---------------------------------------------------------------------------
echo ""
echo "  [formal/checker]: running bounded model checker..."
cd "${REPO_ROOT}"

python3 formal/model_checker.py --bound 30 || {
  echo "  FAIL [formal/checker]: model checker found invariant violation"
  VIOLATIONS=$((VIOLATIONS + 1))
}

# ---------------------------------------------------------------------------
# 4. Run TLC if available (optional, skip in CI without toolbox)
# ---------------------------------------------------------------------------
if command -v tlc &>/dev/null; then
  echo ""
  echo "  [formal/tlc]: TLC found, running full model checking..."
  for tla in "${FORMAL_DIR}"/*.tla; do
    name=$(basename "$tla" .tla)
    cfg="${FORMAL_DIR}/${name}.cfg"
    if [ -f "$cfg" ]; then
      echo "  [formal/tlc]: checking ${name}..."
      tlc "$tla" -config "$cfg" -workers auto 2>&1 | tail -5 || {
        echo "  FAIL [formal/tlc]: TLC found violation in ${name}"
        VIOLATIONS=$((VIOLATIONS + 1))
      }
    else
      echo "  SKIP [formal/tlc]: no ${name}.cfg — skipping TLC for ${name}"
    fi
  done
else
  echo "  INFO [formal/tlc]: TLC not installed — using Python model checker only"
  echo "       To install: https://github.com/tlaplus/tlaplus/releases"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "=== verify:formal PASSED ==="
  exit 0
else
  echo "=== verify:formal FAILED ($VIOLATIONS violation(s)) ==="
  exit 1
fi
