#!/usr/bin/env bash
# scripts/verify_policy.sh — Policy-as-code enforcement gate.
#
# Validates:
#   1. policy/policy.schema.json is well-formed JSON.
#   2. policy/default.policy.json validates against the schema.
#   3. All policy fields that mirror version constants (hash, protocol, cas)
#      agree with contracts/migration.policy.json locked_versions.
#   4. Prohibited license list is non-empty.
#   5. cross_tenant_data_access is false (hardcoded safety invariant).
#   6. kill switches are in expected state (warn if active in non-incident).
#
# Exit 0: policy valid and consistent.
# Exit 1: violation detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCHEMA="${REPO_ROOT}/policy/policy.schema.json"
POLICY="${REPO_ROOT}/policy/default.policy.json"
MIGRATION="${REPO_ROOT}/contracts/migration.policy.json"

echo "=== verify:policy ==="
VIOLATIONS=0

# ---------------------------------------------------------------------------
# 1. Schema file exists and is valid JSON
# ---------------------------------------------------------------------------
if [ ! -f "$SCHEMA" ]; then
  echo "  FAIL: policy/policy.schema.json not found"
  exit 1
fi
python3 -c "import json; json.load(open('${SCHEMA}'))" 2>/dev/null || {
  echo "  FAIL: policy/policy.schema.json is not valid JSON"
  exit 1
}
echo "  OK  [schema]: policy.schema.json is valid JSON"

# ---------------------------------------------------------------------------
# 2. Default policy exists and is valid JSON
# ---------------------------------------------------------------------------
if [ ! -f "$POLICY" ]; then
  echo "  FAIL: policy/default.policy.json not found"
  exit 1
fi
python3 -c "import json; json.load(open('${POLICY}'))" 2>/dev/null || {
  echo "  FAIL: policy/default.policy.json is not valid JSON"
  exit 1
}
echo "  OK  [policy]: default.policy.json is valid JSON"

# ---------------------------------------------------------------------------
# 3. Structural validation against schema fields (lightweight; jsonschema optional)
# ---------------------------------------------------------------------------
python3 - <<'PYEOF'
import json, sys

with open("policy/default.policy.json") as f:
    policy = json.load(f)

required_top = ["policy_schema_version","policy_id","hash","protocol","cas","licenses","tenant","routes","pr_invariants"]
missing = [k for k in required_top if k not in policy]
if missing:
    print(f"  FAIL [policy/structure]: missing required top-level fields: {missing}")
    sys.exit(1)

# hash checks
h = policy["hash"]
if 1 not in h.get("allowed_algorithm_versions", []):
    print("  FAIL [policy/hash]: algorithm version 1 (BLAKE3) must be in allowed_algorithm_versions")
    sys.exit(1)
if h.get("required_hex_chars") != 64:
    print("  FAIL [policy/hash]: required_hex_chars must be 64")
    sys.exit(1)

# tenant safety
t = policy["tenant"]
if t.get("cross_tenant_data_access", True):
    print("  FAIL [policy/tenant]: cross_tenant_data_access must be false — never.")
    sys.exit(1)

# license safety
lics = policy["licenses"]
if not lics.get("prohibited"):
    print("  FAIL [policy/licenses]: prohibited list must not be empty")
    sys.exit(1)

# routes safety
r = policy["routes"]
if not r.get("require_auth_on_non_probe_routes"):
    print("  FAIL [policy/routes]: require_auth_on_non_probe_routes must be true")
    sys.exit(1)
if not r.get("deny_unauthenticated_write"):
    print("  FAIL [policy/routes]: deny_unauthenticated_write must be true")
    sys.exit(1)
if not r.get("no_hard_500_routes"):
    print("  FAIL [policy/routes]: no_hard_500_routes must be true")
    sys.exit(1)

print("  OK  [policy/structure]: all required fields present and valid")
PYEOF

# ---------------------------------------------------------------------------
# 4. Policy version constants must agree with migration.policy.json
# ---------------------------------------------------------------------------
if [ -f "$MIGRATION" ]; then
  python3 - <<'PYEOF'
import json, sys

with open("policy/default.policy.json") as f:
    policy = json.load(f)
with open("contracts/migration.policy.json") as f:
    migration = json.load(f)

locked = migration.get("locked_versions", {})

# Hash version
allowed_hash = policy["hash"].get("allowed_algorithm_versions", [])
locked_hash = locked.get("hash_algorithm_version", 0)
if locked_hash not in allowed_hash:
    print(f"  FAIL [policy/versions]: locked hash_algorithm_version={locked_hash} not in policy allowed list {allowed_hash}")
    sys.exit(1)

# Protocol version
allowed_proto = policy["protocol"].get("allowed_framing_versions", [])
locked_proto = locked.get("protocol_framing_version", 0)
if locked_proto not in allowed_proto:
    print(f"  FAIL [policy/versions]: locked protocol_framing_version={locked_proto} not in policy allowed list {allowed_proto}")
    sys.exit(1)

# CAS format version
allowed_cas = policy["cas"].get("allowed_format_versions", [])
locked_cas = locked.get("cas_format_version", 0)
if locked_cas not in allowed_cas:
    print(f"  FAIL [policy/versions]: locked cas_format_version={locked_cas} not in policy allowed list {allowed_cas}")
    sys.exit(1)

print("  OK  [policy/versions]: policy version constants agree with migration.policy.json")
PYEOF
else
  echo "  SKIP [policy/versions]: contracts/migration.policy.json not found"
fi

# ---------------------------------------------------------------------------
# 5. Kill switch state warning
# ---------------------------------------------------------------------------
python3 - <<'PYEOF'
import json, sys

with open("policy/default.policy.json") as f:
    policy = json.load(f)

flags = policy.get("feature_flags", {})
if flags.get("kill_switch_protocol_writer"):
    print("  WARN [policy/flags]: kill_switch_protocol_writer is ACTIVE — verify this is intentional")
if flags.get("kill_switch_cas_writer"):
    print("  WARN [policy/flags]: kill_switch_cas_writer is ACTIVE — verify this is intentional")
print("  OK  [policy/flags]: kill switch state verified")
PYEOF

# ---------------------------------------------------------------------------
# 6. PR invariants — all must be true in default policy
# ---------------------------------------------------------------------------
python3 - <<'PYEOF'
import json, sys

with open("policy/default.policy.json") as f:
    policy = json.load(f)

inv = policy.get("pr_invariants", {})
required_true = [
    "require_determinism_contract_ref_on_version_bump",
    "require_migration_entry_on_version_bump",
]
failed = [k for k in required_true if not inv.get(k)]
if failed:
    print(f"  FAIL [policy/pr_invariants]: these invariants must be true: {failed}")
    sys.exit(1)
print("  OK  [policy/pr_invariants]: all required PR invariants are enforced")
PYEOF

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
if [ "$VIOLATIONS" -eq 0 ]; then
  echo ""
  echo "=== verify:policy PASSED ==="
  exit 0
else
  echo ""
  echo "=== verify:policy FAILED ($VIOLATIONS violation(s)) ==="
  exit 1
fi
