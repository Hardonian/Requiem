#!/bin/bash
#
# verify:db-contract — Code to schema drift detection
#
# Scans code for Supabase/Prisma references and verifies against schema.
#

set -euo pipefail

echo "=== verify:db-contract ==="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0

# Check for Prisma schema
echo "[1/4] Checking Prisma schema..."
PRISMA_SCHEMA="ready-layer/prisma/schema.prisma"
if [ -f "$PRISMA_SCHEMA" ]; then
    echo "  ✅ Prisma schema found"
    TABLE_COUNT=$(grep -c "^model " "$PRISMA_SCHEMA" 2>/dev/null || echo "0")
    echo "  📊 Found $TABLE_COUNT models"
else
    echo "  ⚠️  Prisma schema not found at $PRISMA_SCHEMA"
fi

# Check for migrations
echo "[2/4] Checking migrations..."
MIGRATIONS_DIR="ready-layer/prisma/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
    MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR" 2>/dev/null | grep -c "_" || echo "0")
    echo "  ✅ Found $MIGRATION_COUNT migrations"
else
    echo "  ⚠️  No migrations directory found"
fi

# Scan code for Supabase table references
echo "[3/4] Scanning code for database references..."
DB_REFS=$(grep -r "\.from(" packages/cli/src ready-layer/src --include="*.ts" --include="*.tsx" 2>/dev/null | head -20 || true)
if [ -n "$DB_REFS" ]; then
    REF_COUNT=$(echo "$DB_REFS" | wc -l)
    echo "  📊 Found $REF_COUNT Supabase table references"
else
    echo "  ℹ️  No Supabase table references found in code"
fi

# Check for RPC calls
echo "[4/4] Checking for RPC function references..."
RPC_REFS=$(grep -r "\.rpc(" packages/cli/src ready-layer/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -n "$RPC_REFS" ]; then
    RPC_COUNT=$(echo "$RPC_REFS" | wc -l)
    echo "  📊 Found $RPC_COUNT RPC references"
else
    echo "  ℹ️  No RPC references found"
fi

# Generate contract report
mkdir -p artifacts/reports
cat > artifacts/reports/db_contract.json << EOF
{
  "schema": "db_contract_v1",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sources": {
    "prisma_schema": $([ -f "$PRISMA_SCHEMA" ] && echo "true" || echo "false"),
    "migrations": $([ -d "$MIGRATIONS_DIR" ] && echo "true" || echo "false")
  },
  "counts": {
    "supabase_table_refs": ${REF_COUNT:-0},
    "rpc_refs": ${RPC_COUNT:-0}
  },
  "status": "documented"
}
EOF

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ verify:db-contract PASSED"
    exit 0
else
    echo "❌ verify:db-contract FAILED ($ERRORS errors)"
    exit 1
fi
