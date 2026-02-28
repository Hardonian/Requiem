#!/bin/sh
# verify_policy_contract.sh
#
# POSIX-compatible script that verifies the AI policy system satisfies its
# structural contract. Prints PASS/FAIL for each check; exits non-zero on any
# failure.
#
# Usage: sh scripts/verify_policy_contract.sh

set -u

PASS=0
FAIL=0
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pass() {
  echo "  PASS  $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL  $1"
  FAIL=$((FAIL + 1))
}

# ─── Check 1-4: Required policy source files exist ────────────────────────────

echo ""
echo "=== Policy source file existence ==="

for f in \
  packages/ai/src/policy/gate.ts \
  packages/ai/src/policy/capabilities.ts \
  packages/ai/src/policy/guardrails.ts \
  packages/ai/src/policy/budgets.ts
do
  if [ -f "$REPO_ROOT/$f" ]; then
    pass "$f exists"
  else
    fail "$f MISSING"
  fi
done

# ─── Check 5: gate.ts calls evaluateGuardrails ────────────────────────────────

echo ""
echo "=== evaluatePolicy calls evaluateGuardrails ==="

GATE="$REPO_ROOT/packages/ai/src/policy/gate.ts"

if grep -q "evaluateGuardrails" "$GATE"; then
  pass "gate.ts imports/calls evaluateGuardrails"
else
  fail "gate.ts does NOT call evaluateGuardrails"
fi

# ─── Check 6: guardrails.ts imports from capabilities.ts (no own role map) ───

echo ""
echo "=== guardrails.ts uses capabilities.ts (no local role map) ==="

GUARDRAILS="$REPO_ROOT/packages/ai/src/policy/guardrails.ts"

if grep -q "from './capabilities'" "$GUARDRAILS" || grep -q 'from "./capabilities"' "$GUARDRAILS"; then
  pass "guardrails.ts imports from capabilities.ts"
else
  fail "guardrails.ts does NOT import from capabilities.ts"
fi

# Ensure guardrails does not maintain its own ROLE_CAPABILITIES map
if grep -q "ROLE_CAPABILITIES" "$GUARDRAILS"; then
  fail "guardrails.ts contains its own ROLE_CAPABILITIES map (should delegate to capabilities.ts)"
else
  pass "guardrails.ts has no duplicate ROLE_CAPABILITIES map"
fi

# ─── Check 7: budgets.ts exports Clock interface ──────────────────────────────

echo ""
echo "=== budgets.ts exports Clock interface ==="

BUDGETS="$REPO_ROOT/packages/ai/src/policy/budgets.ts"

if grep -q "export.*Clock" "$BUDGETS"; then
  pass "budgets.ts exports Clock interface"
else
  fail "budgets.ts does NOT export Clock interface"
fi

# ─── Check 8: rateLimitCheck implementation is not TODO placeholder ───────────

echo ""
echo "=== Rate-limit check is implemented (no TODO) ==="

if grep -q "TODO" "$GUARDRAILS"; then
  fail "guardrails.ts contains TODO — rate limiter may not be implemented"
else
  pass "guardrails.ts contains no TODO markers"
fi

# ─── Check 9: adversarial eval cases JSON exists and is parseable ─────────────

echo ""
echo "=== eval/policy_adversarial_cases.json exists and is valid JSON ==="

CASES="$REPO_ROOT/eval/policy_adversarial_cases.json"

if [ -f "$CASES" ]; then
  pass "eval/policy_adversarial_cases.json exists"
else
  fail "eval/policy_adversarial_cases.json MISSING"
fi

# Validate JSON using node (available in the project environment)
if command -v node > /dev/null 2>&1; then
  if node -e "JSON.parse(require('fs').readFileSync('$CASES','utf8'))" 2>/dev/null; then
    pass "eval/policy_adversarial_cases.json is valid JSON"
  else
    fail "eval/policy_adversarial_cases.json is INVALID JSON"
  fi
else
  echo "  SKIP  node not found — skipping JSON parse check"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "=== Summary ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL — $FAIL check(s) failed"
  exit 1
else
  echo "RESULT: PASS — all checks passed"
  exit 0
fi
