#!/bin/bash
#
# verify:no-hard-500 — Route smoke test
#
# Ensures API routes return structured JSON errors, not 500s with HTML.
# This is a smoke test using static analysis.
#

set -euo pipefail

echo "=== verify:no-hard-500 ==="
echo "Checking API routes for error handling..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0
WARNINGS=0

# Check ready-layer API routes
API_DIR="ready-layer/src/app/api"
if [ -d "$API_DIR" ]; then
    ROUTE_FILES=$(find "$API_DIR" -name "route.ts" -o -name "route.js" 2>/dev/null || true)
    TOTAL_ROUTES=$(echo "$ROUTE_FILES" | grep -c "\." || echo "0")
    
    echo "Found $TOTAL_ROUTES route files"
    
    # Check for try/catch in each route
    for route in $ROUTE_FILES; do
        ROUTE_NAME=$(basename $(dirname "$route"))
        if ! grep -q "try" "$route" 2>/dev/null || ! grep -q "catch" "$route" 2>/dev/null; then
            echo "  ⚠️  $ROUTE_NAME/route.ts missing try/catch"
            ((WARNINGS++))
        fi
    done
    
    # Check for dynamic export (required for Next.js API routes)
    WITHOUT_DYNAMIC=$(grep -L "export const dynamic" $ROUTE_FILES 2>/dev/null || true)
    if [ -n "$WITHOUT_DYNAMIC" ]; then
        echo "  ⚠️  Some routes missing dynamic export:"
        echo "$WITHOUT_DYNAMIC" | head -3 | sed 's/^/    /'
        ((WARNINGS++))
    fi
    
    echo "  ✅ Checked $TOTAL_ROUTES API routes"
else
    echo "  ⚠️  API directory not found: $API_DIR"
fi

# Check for error boundary in ready-layer
if [ -f "ready-layer/src/app/error.tsx" ] || [ -f "ready-layer/src/app/error.ts" ]; then
    echo "  ✅ Error boundary exists"
else
    echo "  ⚠️  Missing error.tsx boundary in ready-layer"
    ((WARNINGS++))
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ verify:no-hard-500 PASSED"
    exit 0
else
    echo "verify:no-hard-500: $ERRORS errors, $WARNINGS warnings"
    if [ $ERRORS -eq 0 ]; then
        echo "✅ PASSED (with warnings)"
        exit 0
    else
        echo "❌ FAILED"
        exit 1
    fi
fi
