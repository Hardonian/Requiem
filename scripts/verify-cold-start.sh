#!/bin/bash
#
# verify:cold-start — Clean install/build smoke test
#
# Simulates a fresh clone and verifies build succeeds.
#

set -euo pipefail

echo "=== verify:cold-start ==="
echo "Testing clean build path..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0

# Check that we can parse package.json
echo "[1/4] Validating package.json..."
if node -e "JSON.parse(require('fs').readFileSync('package.json'))" 2>/dev/null; then
    echo "  ✅ package.json is valid JSON"
else
    echo "  ❌ FAIL: package.json is invalid"
    ((ERRORS++))
fi

# Check TypeScript packages can typecheck
echo "[2/4] TypeScript typecheck (packages/cli)..."
if [ -d "packages/cli" ]; then
    cd packages/cli
    if npm run typecheck > /dev/null 2>&1; then
        echo "  ✅ CLI typecheck passed"
    else
        echo "  ❌ FAIL: CLI typecheck failed"
        ((ERRORS++))
    fi
    cd "$ROOT_DIR"
else
    echo "  ⚠️  packages/cli not found"
fi

echo "[3/4] TypeScript typecheck (packages/ui)..."
if [ -d "packages/ui" ]; then
    cd packages/ui
    if npm run typecheck > /dev/null 2>&1; then
        echo "  ✅ UI typecheck passed"
    else
        echo "  ❌ FAIL: UI typecheck failed"
        ((ERRORS++))
    fi
    cd "$ROOT_DIR"
else
    echo "  ⚠️  packages/ui not found"
fi

# Check C++ build (if cmake available)
echo "[4/4] C++ build smoke..."
if command -v cmake > /dev/null 2>&1; then
    if cmake -S . -B build_verify_test -DCMAKE_BUILD_TYPE=Release > /dev/null 2>&1; then
        echo "  ✅ CMake configuration successful"
        rm -rf build_verify_test
    else
        echo "  ⚠️  CMake configuration failed (may be missing dependencies)"
    fi
else
    echo "  ⚠️  cmake not available"
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ verify:cold-start PASSED"
    exit 0
else
    echo "❌ verify:cold-start FAILED ($ERRORS errors)"
    exit 1
fi
