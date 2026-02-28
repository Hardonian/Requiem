#!/bin/bash
#
# verify:root — Root cleanliness / workspace correctness
#
# Ensures:
# - No untracked files in critical paths
# - No local modifications to protected files
# - Workspace is in a clean state for builds
#

set -euo pipefail

echo "=== verify:root ==="
echo "Checking workspace cleanliness..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0

# Check for uncommitted changes
echo "[1/5] Checking for uncommitted changes..."
if ! git diff --quiet HEAD 2>/dev/null; then
    echo "  ❌ FAIL: Uncommitted changes detected"
    git status --short
    ((ERRORS++))
else
    echo "  ✅ No uncommitted changes"
fi

# Check for untracked files in protected paths
echo "[2/5] Checking for untracked files in protected paths..."
PROTECTED_PATHS=("src/" "include/" "packages/" "ready-layer/src/")
UNTRACKED_FOUND=0
for path in "${PROTECTED_PATHS[@]}"; do
    if [ -d "$path" ]; then
        UNTRACKED=$(git ls-files --others --exclude-standard "$path" 2>/dev/null || true)
        if [ -n "$UNTRACKED" ]; then
            echo "  ⚠️  Untracked in $path:"
            echo "$UNTRACKED" | head -5 | sed 's/^/    /'
            UNTRACKED_FOUND=1
        fi
    fi
done
if [ $UNTRACKED_FOUND -eq 0 ]; then
    echo "  ✅ No concerning untracked files"
fi

# Check package manager consistency
echo "[3/5] Checking package manager consistency..."
LOCKFILE_COUNT=$(ls -1 pnpm-lock.yaml package-lock.json yarn.lock 2>/dev/null | wc -l)
if [ "$LOCKFILE_COUNT" -gt 1 ]; then
    echo "  ❌ FAIL: Multiple lockfiles detected ($LOCKFILE_COUNT)"
    ls -1 pnpm-lock.yaml package-lock.json yarn.lock 2>/dev/null
    ((ERRORS++))
else
    echo "  ✅ Single lockfile present"
fi

# Check packageManager field matches
echo "[4/5] Checking packageManager field..."
PACKAGE_MANAGER=$(cat package.json | grep -o '"packageManager": "[^"]*"' | cut -d'"' -f4 || echo "")
if [ -z "$PACKAGE_MANAGER" ]; then
    echo "  ❌ FAIL: packageManager field missing"
    ((ERRORS++))
elif [[ "$PACKAGE_MANAGER" == pnpm* ]]; then
    if [ ! -f "pnpm-lock.yaml" ]; then
        echo "  ❌ FAIL: packageManager=pnpm but pnpm-lock.yaml missing"
        ((ERRORS++))
    else
        echo "  ✅ packageManager ($PACKAGE_MANAGER) matches lockfile"
    fi
elif [[ "$PACKAGE_MANAGER" == npm* ]]; then
    if [ ! -f "package-lock.json" ]; then
        echo "  ❌ FAIL: packageManager=npm but package-lock.json missing"
        ((ERRORS++))
    else
        echo "  ✅ packageManager ($PACKAGE_MANAGER) matches lockfile"
    fi
fi

# Check node_modules consistency (quick check)
echo "[5/5] Checking node_modules consistency..."
if [ ! -d "node_modules" ]; then
    echo "  ⚠️  node_modules missing (run pnpm install)"
elif [ -f "pnpm-lock.yaml" ]; then
    # Quick check: compare lockfile timestamp to node_modules
    if [ "pnpm-lock.yaml" -nt "node_modules" ]; then
        echo "  ⚠️  pnpm-lock.yaml is newer than node_modules (may need install)"
    else
        echo "  ✅ node_modules appears current"
    fi
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ verify:root PASSED"
    exit 0
else
    echo "❌ verify:root FAILED ($ERRORS errors)"
    exit 1
fi
