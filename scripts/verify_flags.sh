#!/usr/bin/env bash
# verify_flags.sh — Validate the feature flag registry and runtime module.
#
# Checks:
#   1. flags/flags.registry.json is valid JSON
#   2. Every flag has required fields: name/id, scope/tier, status, description
#   3. packages/ai/src/flags/index.ts exists (runtime module)
#   4. Enterprise feature flags have "tier": "enterprise" (not "oss")
#
# Exit code: 0 (all pass), 1 (one or more failures)

set -euo pipefail

REGISTRY="flags/flags.registry.json"
RUNTIME_MODULE="packages/ai/src/flags/index.ts"
PASS=0
FAIL=1
overall=0

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; overall=1; }

echo "=== verify_flags.sh ==="
echo ""

# ── Check 1: Valid JSON ───────────────────────────────────────────────────────
echo "[1] Validating $REGISTRY is valid JSON..."
if [ ! -f "$REGISTRY" ]; then
  fail "$REGISTRY not found"
else
  if python3 -c "import json, sys; json.load(open('$REGISTRY'))" 2>/dev/null; then
    pass "$REGISTRY is valid JSON"
  elif node -e "JSON.parse(require('fs').readFileSync('$REGISTRY','utf8'))" 2>/dev/null; then
    pass "$REGISTRY is valid JSON (via node)"
  else
    fail "$REGISTRY is NOT valid JSON"
  fi
fi
echo ""

# ── Check 2: Required fields per flag ────────────────────────────────────────
echo "[2] Checking required fields (id, tier, status, description) on every flag..."
if [ ! -f "$REGISTRY" ]; then
  fail "Cannot check fields — registry not found"
else
  # Use node to iterate flags and check required fields
  node --input-type=module <<'EOF'
import { readFileSync } from 'fs';
const reg = JSON.parse(readFileSync('flags/flags.registry.json', 'utf8'));
let allOk = true;
for (const flag of reg.flags) {
  const missing = [];
  if (!flag.id)          missing.push('id');
  if (!flag.tier)        missing.push('tier/scope');
  if (!flag.status)      missing.push('status');
  if (!flag.description) missing.push('description');
  if (missing.length > 0) {
    console.error(`  FAIL: Flag "${flag.id ?? '(unknown)'}" missing fields: ${missing.join(', ')}`);
    allOk = false;
  } else {
    console.log(`  PASS: Flag "${flag.id}" has all required fields`);
  }
}
process.exit(allOk ? 0 : 1);
EOF
  if [ $? -ne 0 ]; then overall=1; fi
fi
echo ""

# ── Check 3: Runtime module exists ───────────────────────────────────────────
echo "[3] Checking that runtime module $RUNTIME_MODULE exists..."
if [ -f "$RUNTIME_MODULE" ]; then
  pass "$RUNTIME_MODULE exists"
else
  fail "$RUNTIME_MODULE does NOT exist — run Phase 4 implementation"
fi
echo ""

# ── Check 4: Enterprise flags have tier=enterprise ───────────────────────────
echo "[4] Verifying enterprise feature flags are scoped to 'enterprise' tier..."
if [ ! -f "$REGISTRY" ]; then
  fail "Cannot check tiers — registry not found"
else
  node --input-type=module <<'EOF'
import { readFileSync } from 'fs';
const reg = JSON.parse(readFileSync('flags/flags.registry.json', 'utf8'));
let allOk = true;
// Known enterprise feature flag name patterns
const enterprisePrefixes = ['enable_multi_region', 'enable_signed_replay', 'enable_economic', 'enable_merkle'];
for (const flag of reg.flags) {
  const looksEnterprise = enterprisePrefixes.some(p => flag.id.startsWith(p));
  if (looksEnterprise && flag.tier !== 'enterprise') {
    console.error(`  FAIL: Flag "${flag.id}" looks enterprise but has tier="${flag.tier}" (expected "enterprise")`);
    allOk = false;
  } else if (looksEnterprise) {
    console.log(`  PASS: Flag "${flag.id}" correctly has tier="enterprise"`);
  }
}
// Also check all flags with type=feature and tier=enterprise are not accidentally set to oss
for (const flag of reg.flags) {
  if (flag.type === 'feature' && flag.tier === 'oss') {
    // oss feature flags are allowed (e.g. enable_soft_delete)
    console.log(`  INFO: Flag "${flag.id}" is type=feature tier=oss (compliance/oss feature, OK)`);
  }
}
process.exit(allOk ? 0 : 1);
EOF
  if [ $? -ne 0 ]; then overall=1; fi
fi
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo "=== Summary ==="
if [ "$overall" -eq 0 ]; then
  echo "✅  All flag checks PASSED"
else
  echo "❌  One or more flag checks FAILED"
fi
echo ""

exit $overall
