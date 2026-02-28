#!/bin/bash
#
# verify:provenance — Determinism/replay guardrails
#
# Verifies that determinism invariants are documented and checks are in place.
#

set -euo pipefail

echo "=== verify:provenance ==="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0

# Check determinism contract exists
echo "[1/5] Checking determinism contract..."
if [ -f "contracts/determinism.contract.json" ]; then
    echo "  ✅ Determinism contract exists"
else
    echo "  ❌ FAIL: contracts/determinism.contract.json not found"
    ((ERRORS++))
fi

# Check DETERMINISM.md documentation
echo "[2/5] Checking determinism documentation..."
if [ -f "docs/DETERMINISM.md" ]; then
    echo "  ✅ DETERMINISM.md exists"
else
    echo "  ⚠️  DETERMINISM.md not found"
fi

# Check clock abstraction exists
echo "[3/5] Checking clock abstraction..."
if [ -f "packages/cli/src/lib/clock.ts" ]; then
    echo "  ✅ Clock abstraction exists"
else
    echo "  ❌ FAIL: Clock abstraction not found"
    ((ERRORS++))
fi

# Check for seeded clock implementation
echo "[4/5] Checking seeded clock implementation..."
if grep -q "SeededClock" packages/cli/src/lib/clock.ts 2>/dev/null; then
    echo "  ✅ SeededClock implementation found"
else
    echo "  ❌ FAIL: SeededClock not found"
    ((ERRORS++))
fi

# Check for config snapshot utilities
echo "[5/5] Checking config snapshot utilities..."
if grep -q "ConfigSnapshot\|captureConfigSnapshot" packages/cli/src/lib/clock.ts 2>/dev/null; then
    echo "  ✅ Config snapshot utilities found"
else
    echo "  ❌ FAIL: Config snapshot utilities not found"
    ((ERRORS++))
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ verify:provenance PASSED"
    exit 0
else
    echo "❌ verify:provenance FAILED ($ERRORS errors)"
    exit 1
fi
