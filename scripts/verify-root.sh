#!/bin/bash
# =============================================================================
# verify-root.sh — Verify root-level repo hygiene
# =============================================================================
# Checks:
# - No orphaned secrets in repo
# - No hard-500 routes
# - No duplicate configs
# - Clean structure
# =============================================================================

set -e

echo "🔍 Running root-level verification..."

# Check for secrets patterns in source files
echo "🔐 Checking for exposed secrets..."
if grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" \
    -E "(sk_live|password|secret|api_key|token)" . \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=build \
    --exclude-dir=dist \
    --exclude=*.lock \
    --exclude=package.json \
    --exclude=pnpm-lock.yaml \
    --exclude=.env.example \
    2>/dev/null | grep -v ".env.example" | grep -v "your-" | grep -v "example" | grep -v "placeholder"; then
    echo "❌ Potential secrets found!"
    exit 1
fi
echo "✅ No secrets detected"

# Check for hard 500 errors in routes
echo "📝 Checking for hard 500 routes..."
if grep -r "return.*500" --include="*.ts" --include="*.tsx" . \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=build \
    --exclude-dir=dist \
    2>/dev/null | grep -v "status()" | grep -v "test" | grep -v "// "; then
    echo "⚠️  Found potential hard-coded 500 returns"
fi
echo "✅ Route checks complete"

# Check for duplicate configs
echo "📋 Checking for duplicate configs..."
DUPLICATES=$(find . -maxdepth 2 -name "tsconfig.json" -o -name "eslint.config.*" -o -name "*.config.*" 2>/dev/null | wc -l)
if [ "$DUPLICATES" -gt 3 ]; then
    echo "⚠️  Found $DUPLICATES config files - verify they're intentional"
fi
echo "✅ Config check complete"

# Verify essential files exist
echo "📁 Checking for essential files..."
ESSENTIAL_FILES=("README.md" "LICENSE" "package.json" "pnpm-lock.yaml")
for file in "${ESSENTIAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing essential file: $file"
        exit 1
    fi
done
echo "✅ Essential files present"

# Verify packages exist
echo "📦 Checking package structure..."
if [ ! -d "packages" ]; then
    echo "❌ Missing packages/ directory"
    exit 1
fi
echo "✅ Package structure valid"

echo "✅ Root verification passed"
exit 0
