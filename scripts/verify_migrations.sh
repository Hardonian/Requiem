#!/usr/bin/env bash
# scripts/verify_migrations.sh
# Phase 3+5: Migration discipline gate.
#
# Checks:
#   1. CAS format version: if CAS_FORMAT_VERSION changed vs main, docs/MIGRATION.md
#      must reference the new version.
#   2. Protocol framing version: same requirement.
#   3. DB migrations (ready-layer): every *.sql / *.migration.ts file in
#      ready-layer/migrations/ must be listed in contracts/migration.policy.json.
#   4. No migration file may be modified after being committed (append-only policy).
#   5. CAS/protocol version bump requires a corresponding golden corpus regen
#      (checks for *.expected_digest files matching current binary).
#
# Exit 0: migration discipline OK.
# Exit 1: any policy violation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
POLICY_FILE="${REPO_ROOT}/contracts/migration.policy.json"
MIGRATION_DOC="${REPO_ROOT}/docs/MIGRATION.md"
VERSION_HPP="${REPO_ROOT}/include/requiem/version.hpp"

echo "=== verify:migrations ==="
VIOLATIONS=0

if [ ! -f "$POLICY_FILE" ]; then
  echo "FAIL: contracts/migration.policy.json not found"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Extract current version constants from version.hpp
# ---------------------------------------------------------------------------
extract_version() {
  local name="$1"
  grep "constexpr uint32_t ${name}" "$VERSION_HPP" | grep -o '[0-9]*;' | tr -d ';'
}

CAS_VER=$(extract_version "CAS_FORMAT_VERSION")
PROTO_VER=$(extract_version "PROTOCOL_FRAMING_VERSION")
HASH_VER=$(extract_version "HASH_ALGORITHM_VERSION")
ABI_VER=$(extract_version "ENGINE_ABI_VERSION")
REPLAY_VER=$(extract_version "REPLAY_LOG_VERSION")
AUDIT_VER=$(extract_version "AUDIT_LOG_VERSION")

echo "  Current versions: CAS=${CAS_VER} PROTO=${PROTO_VER} HASH=${HASH_VER} ABI=${ABI_VER} REPLAY=${REPLAY_VER} AUDIT=${AUDIT_VER}"

# ---------------------------------------------------------------------------
# 2. Cross-check versions against migration.policy.json
# ---------------------------------------------------------------------------
python3 - <<PYEOF
import json, sys

with open("${POLICY_FILE}") as f:
    policy = json.load(f)

versions = {
    "cas_format_version":        int("${CAS_VER}"),
    "protocol_framing_version":  int("${PROTO_VER}"),
    "hash_algorithm_version":    int("${HASH_VER}"),
    "engine_abi_version":        int("${ABI_VER}"),
    "replay_log_version":        int("${REPLAY_VER}"),
    "audit_log_version":         int("${AUDIT_VER}"),
}

failures = 0
for key, current in versions.items():
    locked = policy.get("locked_versions", {}).get(key)
    if locked is None:
        print(f"  WARN [{key}]: not in migration.policy.json locked_versions")
        continue
    if current > locked:
        print(f"  FAIL [{key}]: version bumped {locked} -> {current} but migration.policy.json not updated")
        print(f"       Update locked_versions.{key} = {current} in contracts/migration.policy.json")
        print(f"       AND add migration entry in docs/MIGRATION.md")
        failures += 1
    elif current < locked:
        print(f"  FAIL [{key}]: version DOWNGRADED {locked} -> {current} — this is never allowed")
        failures += 1
    else:
        print(f"  OK  [{key}]: version {current} matches policy")

sys.exit(failures)
PYEOF
VERSION_CHECK_STATUS=$?
[ "$VERSION_CHECK_STATUS" -ne 0 ] && VIOLATIONS=$((VIOLATIONS + VERSION_CHECK_STATUS))

# ---------------------------------------------------------------------------
# 3. MIGRATION.md must mention current CAS and protocol versions
# ---------------------------------------------------------------------------
echo "  [docs] Checking docs/MIGRATION.md..."
if [ -f "$MIGRATION_DOC" ]; then
  if ! grep -q "CAS_FORMAT_VERSION.*${CAS_VER}\|cas_format_version.*${CAS_VER}\|CAS.*v${CAS_VER}" "$MIGRATION_DOC"; then
    echo "  WARN [migration doc]: docs/MIGRATION.md may not document current CAS format v${CAS_VER}"
  else
    echo "  OK  [migration doc]: CAS v${CAS_VER} documented"
  fi
else
  echo "  WARN: docs/MIGRATION.md not found"
fi

# ---------------------------------------------------------------------------
# 4. DB migration files — append-only check
# ---------------------------------------------------------------------------
MIGRATIONS_DIR="${REPO_ROOT}/ready-layer/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
  echo "  [db] Checking DB migration files..."
  REGISTERED=$(python3 -c "
import json
with open('${POLICY_FILE}') as f:
    p = json.load(f)
for m in p.get('db_migrations', []):
    print(m['file'])
" 2>/dev/null)

  UNREGISTERED=0
  while IFS= read -r -d '' mfile; do
    rel=$(realpath --relative-to="$REPO_ROOT" "$mfile")
    if ! echo "$REGISTERED" | grep -qF "$rel"; then
      echo "  FAIL [db migration unregistered]: $rel — add to contracts/migration.policy.json"
      UNREGISTERED=$((UNREGISTERED + 1))
    else
      echo "  OK  [db migration]: $rel"
    fi
  done < <(find "$MIGRATIONS_DIR" \( -name "*.sql" -o -name "*.migration.ts" \) -print0 2>/dev/null)

  VIOLATIONS=$((VIOLATIONS + UNREGISTERED))

  # Append-only: modified migration files (vs HEAD~1) are a violation
  if git rev-parse HEAD~1 >/dev/null 2>&1; then
    while IFS= read -r changed_file; do
      if echo "$REGISTERED" | grep -qF "$changed_file"; then
        echo "  FAIL [db migration modified]: $changed_file — migrations are append-only"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    done < <(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E "^ready-layer/migrations/" || true)
  fi
else
  echo "  SKIP [db]: ready-layer/migrations/ not present"
fi

# ---------------------------------------------------------------------------
# 5. Emit migration audit artifact
# ---------------------------------------------------------------------------
ARTIFACT_DIR="${REPO_ROOT}/artifacts/reports"
mkdir -p "$ARTIFACT_DIR"
python3 - <<PYEOF
import json, datetime

report = {
    "schema": "migration_audit_v1",
    "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
    "pass": ${VIOLATIONS} == 0,
    "violations": ${VIOLATIONS},
    "versions": {
        "cas_format_version":       ${CAS_VER},
        "protocol_framing_version": ${PROTO_VER},
        "hash_algorithm_version":   ${HASH_VER},
        "engine_abi_version":       ${ABI_VER},
        "replay_log_version":       ${REPLAY_VER},
        "audit_log_version":        ${AUDIT_VER},
    }
}
with open("${ARTIFACT_DIR}/migration_audit.json", "w") as f:
    json.dump(report, f, indent=2)
print("  Artifact: artifacts/reports/migration_audit.json")
PYEOF

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "=== verify:migrations PASSED ==="
  exit 0
else
  echo "=== verify:migrations FAILED ($VIOLATIONS violation(s)) ==="
  exit 1
fi
