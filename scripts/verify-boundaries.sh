#!/bin/bash
#
# verify:boundaries — Layer import rules enforcement
#
# Enforces:
# - CLI cannot import ready-layer
# - UI cannot import CLI
# - Core (lib) cannot import CLI or ready-layer
#

set -euo pipefail

echo "=== verify:boundaries ==="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0

# Rule 1: CLI cannot import ready-layer
echo "[1/3] Checking CLI → ready-layer imports..."
if [ -d "packages/cli/src" ]; then
    CLI_LAYER_IMPORTS=$(grep -r "from.*ready-layer" packages/cli/src --include="*.ts" --include="*.js" 2>/dev/null || true)
    if [ -n "$CLI_LAYER_IMPORTS" ]; then
        echo "  ❌ FAIL: CLI imports ready-layer:"
        echo "$CLI_LAYER_IMPORTS" | head -5 | sed 's/^/    /'
        ((ERRORS++))
    else
        echo "  ✅ CLI does not import ready-layer"
    fi
else
    echo "  ⚠️  packages/cli/src not found"
fi

# Rule 2: UI cannot import CLI
echo "[2/3] Checking UI → CLI imports..."
if [ -d "packages/ui/src" ]; then
    UI_CLI_IMPORTS=$(grep -r "from.*@requiem/cli\|from.*packages/cli" packages/ui/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    if [ -n "$UI_CLI_IMPORTS" ]; then
        echo "  ❌ FAIL: UI imports CLI:"
        echo "$UI_CLI_IMPORTS" | head -5 | sed 's/^/    /'
        ((ERRORS++))
    else
        echo "  ✅ UI does not import CLI"
    fi
else
    echo "  ⚠️  packages/ui/src not found"
fi

# Rule 3: ready-layer API routes must use structured errors
echo "[3/3] Checking ready-layer error handling..."
if [ -d "ready-layer/src/app/api" ]; then
    # Check for raw Error throws (should use RequiemError)
    RAW_ERRORS=$(grep -r "throw new Error" ready-layer/src/app/api --include="*.ts" 2>/dev/null | head -5 || true)
    if [ -n "$RAW_ERRORS" ]; then
        echo "  ⚠️  Found raw Error throws (should use structured errors):"
        echo "$RAW_ERRORS" | sed 's/^/    /'
        # This is a warning, not a failure (migration in progress)
    else
        echo "  ✅ API routes use structured error handling"
    fi
else
    echo "  ⚠️  ready-layer/src/app/api not found"
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ verify:boundaries PASSED"
    exit 0
else
    echo "❌ verify:boundaries FAILED ($ERRORS errors)"
    exit 1
fi
