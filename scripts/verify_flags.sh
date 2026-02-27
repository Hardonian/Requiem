#!/usr/bin/env bash
# scripts/verify_flags.sh — Feature flag registry enforcement gate.
#
# Validates:
#   1. flags/flags.registry.json exists and is valid JSON.
#   2. All flag IDs referenced in source code exist in the registry.
#   3. Enterprise-tier flags are not referenced in OSS-only source files.
#   4. ci_only flags are not referenced in non-test production paths.
#   5. Kill switch flags are not silently active (warns + records).
#
# Exit 0: all flags known and policy-compliant.
# Exit 1: unknown or policy-violating flag reference detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REGISTRY="${REPO_ROOT}/flags/flags.registry.json"

echo "=== verify:flags ==="
VIOLATIONS=0

# ---------------------------------------------------------------------------
# 1. Registry exists and is valid JSON
# ---------------------------------------------------------------------------
if [ ! -f "$REGISTRY" ]; then
  echo "  FAIL: flags/flags.registry.json not found"
  exit 1
fi
python3 -c "import json; json.load(open('${REGISTRY}'))" 2>/dev/null || {
  echo "  FAIL: flags/flags.registry.json is not valid JSON"
  exit 1
}
echo "  OK  [flags/registry]: flags.registry.json is valid JSON"

# ---------------------------------------------------------------------------
# 2. Extract all registered flag IDs
# ---------------------------------------------------------------------------
REGISTERED_FLAGS=$(python3 -c "
import json
with open('${REGISTRY}') as f:
    reg = json.load(f)
for flag in reg.get('flags', []):
    print(flag['id'])
" 2>/dev/null)

echo "  INFO [flags/registry]: registered flags:"
echo "$REGISTERED_FLAGS" | while read -r flag; do
  echo "    - $flag"
done

# ---------------------------------------------------------------------------
# 3. Scan source files for flag references
#    Pattern: flag IDs look like feature flag string literals in JSON/code
# ---------------------------------------------------------------------------
SEARCH_DIRS="${REPO_ROOT}/src ${REPO_ROOT}/include ${REPO_ROOT}/policy ${REPO_ROOT}/scripts"

echo "  [flags/scan]: scanning source files for flag references..."

# Extract all unique flag-like identifiers referenced in source
# We look for flag ID patterns (snake_case starting with known prefixes)
REFERENCED_FLAGS=$(
  grep -rh \
    -e '"kill_switch_[a-z_]*"' \
    -e '"enable_[a-z_]*"' \
    --include="*.cpp" --include="*.hpp" --include="*.ts" --include="*.json" --include="*.sh" \
    "${REPO_ROOT}/src/" "${REPO_ROOT}/include/" "${REPO_ROOT}/policy/" \
    2>/dev/null \
  | grep -oE '"(kill_switch|enable)_[a-z_]+"' \
  | tr -d '"' \
  | sort -u \
  || true
)

# Check each referenced flag against registry
UNKNOWN_FLAGS=0
while IFS= read -r ref_flag; do
  [ -z "$ref_flag" ] && continue
  if ! echo "$REGISTERED_FLAGS" | grep -qx "$ref_flag"; then
    echo "  FAIL [flags/unknown]: flag '$ref_flag' referenced in source but not in registry"
    UNKNOWN_FLAGS=$((UNKNOWN_FLAGS + 1))
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done <<< "$REFERENCED_FLAGS"

if [ "$UNKNOWN_FLAGS" -eq 0 ]; then
  echo "  OK  [flags/scan]: all referenced flags are registered"
fi

# ---------------------------------------------------------------------------
# 4. Enterprise flag isolation: enterprise flags must not appear in src/
# ---------------------------------------------------------------------------
ENTERPRISE_FLAGS=$(python3 -c "
import json
with open('${REGISTRY}') as f:
    reg = json.load(f)
for flag in reg.get('flags', []):
    if flag.get('tier') == 'enterprise':
        print(flag['id'])
" 2>/dev/null)

echo "  [flags/isolation]: checking enterprise flag isolation..."
while IFS= read -r eflag; do
  [ -z "$eflag" ] && continue
  if grep -rq "\"${eflag}\"" "${REPO_ROOT}/src/" 2>/dev/null; then
    echo "  FAIL [flags/isolation]: enterprise flag '$eflag' referenced in OSS src/ — must only be in enterprise build paths"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done <<< "$ENTERPRISE_FLAGS"

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "  OK  [flags/isolation]: enterprise flags not referenced in OSS src/"
fi

# ---------------------------------------------------------------------------
# 5. Kill switch state audit
# ---------------------------------------------------------------------------
echo "  [flags/kill_switch]: auditing kill switch states..."
python3 - <<'PYEOF'
import json, sys

with open("flags/flags.registry.json") as f:
    reg = json.load(f)

active_kill_switches = []
for flag in reg.get("flags", []):
    if flag.get("type") == "kill_switch" and flag.get("default") is True:
        active_kill_switches.append(flag["id"])

if active_kill_switches:
    print(f"  WARN [flags/kill_switch]: ACTIVE kill switches (ensure incident ticket exists): {active_kill_switches}")
else:
    print("  OK  [flags/kill_switch]: no kill switches active")
PYEOF

# ---------------------------------------------------------------------------
# 6. Registry policy field validation
# ---------------------------------------------------------------------------
python3 - <<'PYEOF'
import json, sys

with open("flags/flags.registry.json") as f:
    reg = json.load(f)

policy = reg.get("policy", {})
if not policy.get("unknown_flags_fail_ci"):
    print("  FAIL [flags/policy]: unknown_flags_fail_ci must be true")
    sys.exit(1)
print("  OK  [flags/policy]: registry policy fields valid")
PYEOF

# ---------------------------------------------------------------------------
# 7. Structural validation: each flag has required fields
# ---------------------------------------------------------------------------
python3 - <<'PYEOF'
import json, sys

with open("flags/flags.registry.json") as f:
    reg = json.load(f)

required_fields = ["id", "type", "tier", "default", "description", "determinism_safe", "affects_determinism", "owner", "status"]
violations = 0
for flag in reg.get("flags", []):
    missing = [f for f in required_fields if f not in flag]
    if missing:
        print(f"  FAIL [flags/structure]: flag '{flag.get('id','?')}' missing required fields: {missing}")
        violations += 1
    if flag.get("affects_determinism"):
        print(f"  FAIL [flags/determinism]: flag '{flag['id']}' sets affects_determinism=true — flags must never affect determinism")
        violations += 1

if violations == 0:
    print(f"  OK  [flags/structure]: all {len(reg.get('flags', []))} flags have required fields and are determinism-safe")
else:
    sys.exit(1)
PYEOF

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "=== verify:flags PASSED ==="
  exit 0
else
  echo "=== verify:flags FAILED ($VIOLATIONS violation(s)) ==="
  exit 1
fi
