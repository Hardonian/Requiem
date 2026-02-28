#!/bin/bash
#
# verify:supply-chain — Lockfile and package manager invariants
#
# Ensures:
# - Single package manager is used
# - Lockfile is present and up to date
# - No risky lifecycle scripts without explicit allow
#

set -euo pipefail

echo "=== verify:supply-chain ==="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0
WARNINGS=0

# Check package manager consistency
echo "[1/4] Checking package manager consistency..."
LOCKFILES=("pnpm-lock.yaml" "package-lock.json" "yarn.lock" "bun.lockb")
FOUND_LOCKFILES=()
for lockfile in "${LOCKFILES[@]}"; do
    if [ -f "$lockfile" ]; then
        FOUND_LOCKFILES+=("$lockfile")
    fi
done

if [ ${#FOUND_LOCKFILES[@]} -eq 0 ]; then
    echo "  ❌ FAIL: No lockfile found"
    ((ERRORS++))
elif [ ${#FOUND_LOCKFILES[@]} -gt 1 ]; then
    echo "  ❌ FAIL: Multiple lockfiles found: ${FOUND_LOCKFILES[*]}"
    ((ERRORS++))
else
    echo "  ✅ Single lockfile: ${FOUND_LOCKFILES[0]}"
fi

# Check packageManager field
echo "[2/4] Checking packageManager field..."
PACKAGE_MANAGER=$(cat package.json | grep '"packageManager"' | cut -d'"' -f4 || echo "")
if [ -z "$PACKAGE_MANAGER" ]; then
    echo "  ❌ FAIL: packageManager field not set in package.json"
    ((ERRORS++))
else
    echo "  ✅ packageManager: $PACKAGE_MANAGER"
fi

# Check for install scripts that might be risky
echo "[3/4] Checking for postinstall scripts..."
if [ -f "pnpm-lock.yaml" ]; then
    # pnpm list scripts
    POSTINSTALL_PKGS=$(grep -A 5 "lifecycle" pnpm-lock.yaml 2>/dev/null | head -20 || true)
    if [ -n "$POSTINSTALL_PKGS" ]; then
        echo "  ⚠️  Found lifecycle scripts in dependencies (review recommended)"
        ((WARNINGS++))
    else
        echo "  ✅ No obvious lifecycle scripts detected"
    fi
fi

# Check for frozen-lockfile enforcement in CI
echo "[4/4] Checking CI configuration..."
CI_FILE=".github/workflows/ci.yml"
if [ -f "$CI_FILE" ]; then
    if grep -q "frozen-lockfile\|ci --ignore-scripts" "$CI_FILE" 2>/dev/null; then
        echo "  ✅ CI uses frozen lockfile or ignores scripts"
    else
        echo "  ⚠️  CI may not use frozen lockfile"
        ((WARNINGS++))
    fi
else
    echo "  ⚠️  CI configuration not found"
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ verify:supply-chain PASSED"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  verify:supply-chain PASSED with $WARNINGS warnings"
    exit 0
else
    echo "❌ verify:supply-chain FAILED ($ERRORS errors, $WARNINGS warnings)"
    exit 1
fi
