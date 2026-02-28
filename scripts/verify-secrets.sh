#!/bin/bash
#
# verify:secrets — Lightweight secret scanner
#
# Scans for common secret patterns and ensures .env files are not committed.
#

set -euo pipefail

echo "=== verify:secrets ==="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0
WARNINGS=0

# Secret patterns to detect
PATTERNS=(
    "api[_-]?key['\"\s]*[:=]['\"\s]*[a-zA-Z0-9]{32,}"
    "secret['\"\s]*[:=]['\"\s]*[a-zA-Z0-9]{32,}"
    "password['\"\s]*[:=]['\"\s]*[^\s'\"]{8,}"
    "private[_-]?key['\"\s]*[:=]['\"\s]*[a-zA-Z0-9/+=]{40,}"
    "sk-[a-zA-Z0-9]{48}"  # OpenAI-style keys
    "gh[pousr]_[A-Za-z0-9_]{36,}"  # GitHub tokens
)

# Files to exclude (test fixtures, examples)
EXCLUDE_PATTERN="\.test\.|\.spec\.|example|fixture|testdata|\.md$"

# Check for .env files in git
echo "[1/3] Checking for committed .env files..."
ENV_FILES=$(git ls-files | grep -E "\.env" | grep -v "$EXCLUDE_PATTERN" | grep -v "\.env\.example" || true)
if [ -n "$ENV_FILES" ]; then
    echo "  ❌ FAIL: .env files found in git:"
    echo "$ENV_FILES" | sed 's/^/    /'
    ((ERRORS++))
else
    echo "  ✅ No .env files in git"
fi

# Scan for secrets in source files
echo "[2/3] Scanning for secret patterns..."
FOUND_SECRETS=0
for pattern in "${PATTERNS[@]}"; do
    MATCHES=$(git grep -i -E "$pattern" -- "*.ts" "*.tsx" "*.js" "*.json" 2>/dev/null | grep -v "$EXCLUDE_PATTERN" || true)
    if [ -n "$MATCHES" ]; then
        COUNT=$(echo "$MATCHES" | wc -l)
        echo "  ⚠️  Pattern '$pattern': $COUNT potential matches"
        echo "$MATCHES" | head -3 | sed 's/^/    /'
        ((FOUND_SECRETS+=COUNT))
    fi
done

if [ $FOUND_SECRETS -eq 0 ]; then
    echo "  ✅ No obvious secrets detected"
else
    echo "  ⚠️  Found $FOUND_SECRETS potential secrets (review required)"
    ((WARNINGS++))
fi

# Check .gitignore for .env
echo "[3/3] Checking .gitignore configuration..."
if grep -q "\.env" .gitignore 2>/dev/null; then
    echo "  ✅ .gitignore includes .env"
else
    echo "  ⚠️  .gitignore does not include .env"
    ((WARNINGS++))
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ verify:secrets PASSED"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  verify:secrets PASSED with $WARNINGS warnings"
    exit 0
else
    echo "❌ verify:secrets FAILED ($ERRORS errors, $WARNINGS warnings)"
    exit 1
fi
