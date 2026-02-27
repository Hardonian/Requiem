#!/usr/bin/env bash
# scripts/verify_compat_matrix.sh — Compatibility matrix enforcement gate.
#
# Validates:
#   1. contracts/compat.matrix.json is valid JSON with required fields.
#   2. current_versions in the matrix matches version constants in version.hpp.
#   3. version_history has exactly one 'current' entry.
#   4. All incompatible_combinations entries reference valid fields.
#   5. CI fails if version.hpp constants changed without matrix update.
#
# Exit 0: matrix valid and consistent with version.hpp.
# Exit 1: version drift or structural violation detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MATRIX="${REPO_ROOT}/contracts/compat.matrix.json"
VERSION_HPP="${REPO_ROOT}/include/requiem/version.hpp"

echo "=== verify:compat_matrix ==="
VIOLATIONS=0

# ---------------------------------------------------------------------------
# 1. Matrix file exists and is valid JSON
# ---------------------------------------------------------------------------
if [ ! -f "$MATRIX" ]; then
  echo "  FAIL: contracts/compat.matrix.json not found"
  exit 1
fi
python3 -c "import json; json.load(open('${MATRIX}'))" 2>/dev/null || {
  echo "  FAIL: contracts/compat.matrix.json is not valid JSON"
  exit 1
}
echo "  OK  [matrix]: compat.matrix.json is valid JSON"

# ---------------------------------------------------------------------------
# 2. Extract version constants from version.hpp
# ---------------------------------------------------------------------------
if [ ! -f "$VERSION_HPP" ]; then
  echo "  FAIL: include/requiem/version.hpp not found"
  exit 1
fi

extract_const() {
  local name=$1
  grep -E "constexpr uint32_t ${name}" "$VERSION_HPP" | grep -oE '[0-9]+' | tail -1
}

HPP_ENGINE_ABI=$(extract_const "ENGINE_ABI_VERSION")
HPP_HASH=$(extract_const "HASH_ALGORITHM_VERSION")
HPP_CAS=$(extract_const "CAS_FORMAT_VERSION")
HPP_PROTOCOL=$(extract_const "PROTOCOL_FRAMING_VERSION")
HPP_REPLAY=$(extract_const "REPLAY_LOG_VERSION")
HPP_AUDIT=$(extract_const "AUDIT_LOG_VERSION")

echo "  INFO [matrix/hpp]: version.hpp constants:"
echo "    ENGINE_ABI_VERSION       = ${HPP_ENGINE_ABI}"
echo "    HASH_ALGORITHM_VERSION   = ${HPP_HASH}"
echo "    CAS_FORMAT_VERSION       = ${HPP_CAS}"
echo "    PROTOCOL_FRAMING_VERSION = ${HPP_PROTOCOL}"
echo "    REPLAY_LOG_VERSION       = ${HPP_REPLAY}"
echo "    AUDIT_LOG_VERSION        = ${HPP_AUDIT}"

# ---------------------------------------------------------------------------
# 3. Cross-validate matrix current_versions vs version.hpp
# ---------------------------------------------------------------------------
python3 - <<PYEOF
import json, sys

with open("${MATRIX}") as f:
    matrix = json.load(f)

current = matrix.get("current_versions", {})
violations = 0

checks = [
    ("engine_abi_version",      ${HPP_ENGINE_ABI:-0}),
    ("hash_algorithm_version",  ${HPP_HASH:-0}),
    ("cas_format_version",      ${HPP_CAS:-0}),
    ("protocol_framing_version",${HPP_PROTOCOL:-0}),
    ("replay_log_version",      ${HPP_REPLAY:-0}),
    ("audit_log_version",       ${HPP_AUDIT:-0}),
]

for field, hpp_val in checks:
    matrix_val = current.get(field)
    if matrix_val is None:
        print(f"  FAIL [matrix/sync]: current_versions missing '{field}'")
        violations += 1
    elif matrix_val != hpp_val:
        print(f"  FAIL [matrix/sync]: {field} mismatch: matrix={matrix_val} hpp={hpp_val}")
        print(f"    -> Update contracts/compat.matrix.json current_versions.{field} to {hpp_val}")
        violations += 1
    else:
        print(f"  OK  [matrix/sync]: {field} = {hpp_val}")

if violations > 0:
    sys.exit(1)
PYEOF
[ $? -ne 0 ] && VIOLATIONS=$((VIOLATIONS + 1))

# ---------------------------------------------------------------------------
# 4. Exactly one 'current' entry in version_history
# ---------------------------------------------------------------------------
python3 - <<'PYEOF'
import json, sys

with open("contracts/compat.matrix.json") as f:
    matrix = json.load(f)

history = matrix.get("version_history", [])
current_entries = [e for e in history if e.get("status") == "current"]

if len(current_entries) != 1:
    print(f"  FAIL [matrix/history]: expected exactly 1 'current' entry in version_history, found {len(current_entries)}")
    sys.exit(1)

print(f"  OK  [matrix/history]: exactly 1 current entry: {current_entries[0].get('engine_semver')}")
PYEOF
[ $? -ne 0 ] && VIOLATIONS=$((VIOLATIONS + 1))

# ---------------------------------------------------------------------------
# 5. incompatible_combinations structural check
# ---------------------------------------------------------------------------
python3 - <<'PYEOF'
import json, sys

with open("contracts/compat.matrix.json") as f:
    matrix = json.load(f)

valid_fields = {"engine_abi_version","hash_algorithm_version","cas_format_version",
                "protocol_framing_version","replay_log_version","audit_log_version",
                "cluster_auth_version"}

violations = 0
for combo in matrix.get("incompatible_combinations", []):
    for key in ["field_a", "field_b", "reason", "action"]:
        if key not in combo:
            print(f"  FAIL [matrix/incompatible]: entry missing required field '{key}': {combo}")
            violations += 1

if violations == 0:
    print(f"  OK  [matrix/incompatible]: {len(matrix.get('incompatible_combinations',[]))} incompatible combination(s) structurally valid")
else:
    sys.exit(1)
PYEOF
[ $? -ne 0 ] && VIOLATIONS=$((VIOLATIONS + 1))

# ---------------------------------------------------------------------------
# 6. Cross-check matrix vs migration.policy.json locked_versions
# ---------------------------------------------------------------------------
MIGRATION="${REPO_ROOT}/contracts/migration.policy.json"
if [ -f "$MIGRATION" ]; then
  python3 - <<'PYEOF'
import json, sys

with open("contracts/compat.matrix.json") as f:
    matrix = json.load(f)
with open("contracts/migration.policy.json") as f:
    migration = json.load(f)

current = matrix.get("current_versions", {})
locked = migration.get("locked_versions", {})

cross_checks = [
    ("engine_abi_version",       "engine_abi_version"),
    ("hash_algorithm_version",   "hash_algorithm_version"),
    ("cas_format_version",       "cas_format_version"),
    ("protocol_framing_version", "protocol_framing_version"),
    ("replay_log_version",       "replay_log_version"),
    ("audit_log_version",        "audit_log_version"),
]

violations = 0
for matrix_field, migration_field in cross_checks:
    mv = current.get(matrix_field)
    lv = locked.get(migration_field)
    if mv is not None and lv is not None and mv != lv:
        print(f"  FAIL [matrix/migration-sync]: compat.matrix.json:{matrix_field}={mv} != migration.policy.json:{migration_field}={lv}")
        violations += 1

if violations == 0:
    print("  OK  [matrix/migration-sync]: compat.matrix and migration.policy versions agree")
else:
    sys.exit(1)
PYEOF
  [ $? -ne 0 ] && VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "=== verify:compat_matrix PASSED ==="
  exit 0
else
  echo "=== verify:compat_matrix FAILED ($VIOLATIONS violation(s)) ==="
  exit 1
fi
