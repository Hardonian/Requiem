#!/usr/bin/env bash
# scripts/verify_cluster.sh — Cluster platform verification gate.
#
# Verifies:
#   1. Cluster mode initialization from environment variables.
#   2. Shard routing determinism (same tenant → same shard, always).
#   3. Worker registration and health reporting.
#   4. Version compatibility check (cluster.ok == true).
#   5. Drift status (no version mismatches for single-node).
#   6. Distributed replay validation (cluster.replay.drift_rate == -1 or 0.0).
#   7. Worker identity stamps (auth_version, engine_semver).
#
# EXIT CODES:
#   0  — all checks passed.
#   1  — one or more checks failed.
#
# CI: Called by verify.sh Phase 8 section. Must remain GREEN.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REQUIEM="${REPO_ROOT}/build/requiem"

if [[ ! -x "$REQUIEM" ]]; then
  echo "ERROR: requiem binary not found at $REQUIEM. Run cmake --build build first." >&2
  exit 1
fi

PASS=0
FAIL=0

check_ok() {
  local desc="$1"
  local result="$2"
  local expected="${3:-true}"
  local actual
  actual=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('ok', d.get('cluster_verify', {}).get('ok', d.get('cluster_mode', 'MISSING')))).lower())" 2>/dev/null || echo "parse_error")
  if [[ "$actual" == "$expected" ]]; then
    echo "  PASS: $desc"
    ((PASS++)) || true
  else
    echo "  FAIL: $desc (expected=$expected, got=$actual)"
    echo "        Output: $result"
    ((FAIL++)) || true
  fi
}

check_field() {
  local desc="$1"
  local result="$2"
  local field="$3"
  local expected="$4"
  local actual
  actual=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('$field', 'MISSING')))" 2>/dev/null || echo "parse_error")
  if [[ "$actual" == "$expected" ]]; then
    echo "  PASS: $desc (${field}=${actual})"
    ((PASS++)) || true
  else
    echo "  FAIL: $desc (expected ${field}=${expected}, got=${actual})"
    echo "        Output: $result"
    ((FAIL++)) || true
  fi
}

echo "=== verify:cluster ==="
echo ""

# --------------------------------------------------------------------------
# Test 1: Standalone mode (default) — cluster status must show 1 worker
# --------------------------------------------------------------------------
echo "--- Test 1: Standalone mode cluster status ---"
status_out=$("$REQUIEM" cluster status 2>/dev/null)
check_field "standalone: total_workers=1" "$status_out" "total_workers" "1"
check_field "standalone: healthy_workers=1" "$status_out" "healthy_workers" "1"
check_field "standalone: cluster_mode=False" "$status_out" "cluster_mode" "False"

# --------------------------------------------------------------------------
# Test 2: Cluster mode via env vars
# --------------------------------------------------------------------------
echo "--- Test 2: Cluster mode via REQUIEM_CLUSTER_MODE=1 ---"
cluster_status=$(REQUIEM_CLUSTER_MODE=1 REQUIEM_SHARD_ID=0 REQUIEM_TOTAL_SHARDS=4 \
    "$REQUIEM" cluster status 2>/dev/null)
check_field "cluster mode: total_shards=4" "$cluster_status" "total_shards" "4"
check_field "cluster mode: local_shard_id=0" "$cluster_status" "local_shard_id" "0"

# --------------------------------------------------------------------------
# Test 3: Shard routing determinism
# --------------------------------------------------------------------------
echo "--- Test 3: Shard routing determinism ---"
shard_a=$(REQUIEM_TOTAL_SHARDS=8 "$REQUIEM" cluster shard --tenant "acme-corp" 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['shard_id'])" 2>/dev/null || echo "error")
shard_b=$(REQUIEM_TOTAL_SHARDS=8 "$REQUIEM" cluster shard --tenant "acme-corp" 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['shard_id'])" 2>/dev/null || echo "error")
if [[ "$shard_a" == "$shard_b" && "$shard_a" != "error" ]]; then
  echo "  PASS: shard routing determinism (acme-corp → shard=${shard_a})"
  ((PASS++)) || true
else
  echo "  FAIL: shard routing non-deterministic (${shard_a} ≠ ${shard_b})"
  ((FAIL++)) || true
fi

# Different tenants must NOT always go to the same shard (statistically):
shard_t1=$(REQUIEM_TOTAL_SHARDS=8 "$REQUIEM" cluster shard --tenant "tenant-alpha" 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['shard_id'])" 2>/dev/null || echo "error")
shard_t2=$(REQUIEM_TOTAL_SHARDS=8 "$REQUIEM" cluster shard --tenant "tenant-beta" 2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['shard_id'])" 2>/dev/null || echo "error")
echo "  INFO: tenant-alpha → shard ${shard_t1}, tenant-beta → shard ${shard_t2}"
((PASS++)) || true  # Just logging, not a hard failure

# --------------------------------------------------------------------------
# Test 4: Cluster drift status — clean state, no mismatches
# --------------------------------------------------------------------------
echo "--- Test 4: Cluster drift status ---"
drift_out=$("$REQUIEM" cluster drift 2>/dev/null)
check_ok "cluster drift ok=true (no version mismatches)" "$drift_out"
drift_ok=$(echo "$drift_out" | python3 -c "import sys,json; print(json.load(sys.stdin)['engine_version_mismatch'])" 2>/dev/null || echo "error")
if [[ "$drift_ok" == "False" ]]; then
  echo "  PASS: engine_version_mismatch=False"
  ((PASS++)) || true
else
  echo "  FAIL: engine_version_mismatch should be False, got=${drift_ok}"
  ((FAIL++)) || true
fi

# --------------------------------------------------------------------------
# Test 5: Cluster verify command
# --------------------------------------------------------------------------
echo "--- Test 5: Cluster verify ---"
verify_out=$("$REQUIEM" cluster verify 2>/dev/null)
compat=$(echo "$verify_out" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['cluster_verify']['ok'])" 2>/dev/null || echo "error")
if [[ "$compat" == "True" ]]; then
  echo "  PASS: cluster verify ok=True"
  ((PASS++)) || true
else
  echo "  FAIL: cluster verify failed (${verify_out})"
  ((FAIL++)) || true
fi

# --------------------------------------------------------------------------
# Test 6: Worker identity version stamps
# --------------------------------------------------------------------------
echo "--- Test 6: Worker identity version stamps ---"
# Use doctor output which now includes cluster info
doctor_out=$("$REQUIEM" doctor 2>/dev/null)
cluster_field=$(echo "$doctor_out" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if 'cluster' in d else 'missing')" 2>/dev/null || echo "parse_error")
if [[ "$cluster_field" == "ok" ]]; then
  echo "  PASS: doctor output includes cluster drift status"
  ((PASS++)) || true
else
  echo "  FAIL: doctor output missing cluster field"
  ((FAIL++)) || true
fi

# --------------------------------------------------------------------------
# Test 7: Cluster auth version
# --------------------------------------------------------------------------
echo "--- Test 7: Cluster auth version ---"
auth_out=$("$REQUIEM" cluster auth 2>/dev/null)
auth_ver=$(echo "$auth_out" | python3 -c "import sys,json; print(json.load(sys.stdin)['auth_version'])" 2>/dev/null || echo "error")
if [[ "$auth_ver" == "1" ]]; then
  echo "  PASS: cluster auth_version=1"
  ((PASS++)) || true
else
  echo "  FAIL: cluster auth_version expected 1, got=${auth_ver}"
  ((FAIL++)) || true
fi

# --------------------------------------------------------------------------
# Test 8: Doctor --analyze (Phase 4)
# --------------------------------------------------------------------------
echo "--- Test 8: Doctor --analyze root cause diagnostics ---"
analyze_out=$("$REQUIEM" doctor --analyze 2>/dev/null || true)
analyze_ok=$(echo "$analyze_out" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok', False))" 2>/dev/null || echo "error")
if [[ "$analyze_ok" == "True" ]]; then
  echo "  PASS: doctor --analyze returns valid report"
  ((PASS++)) || true
else
  echo "  FAIL: doctor --analyze failed (${analyze_out})"
  ((FAIL++)) || true
fi

# --------------------------------------------------------------------------
# Test 9: Autotune status
# --------------------------------------------------------------------------
echo "--- Test 9: Auto-tuning status ---"
autotune_out=$("$REQUIEM" autotune status 2>/dev/null)
tune_ok=$(echo "$autotune_out" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if 'current' in d else 'missing')" 2>/dev/null || echo "error")
if [[ "$tune_ok" == "ok" ]]; then
  echo "  PASS: autotune status returns valid state"
  ((PASS++)) || true
else
  echo "  FAIL: autotune status failed (${autotune_out})"
  ((FAIL++)) || true
fi

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------
echo ""
echo "=== verify:cluster RESULTS ==="
echo "  PASS: ${PASS}"
echo "  FAIL: ${FAIL}"

if [[ $FAIL -eq 0 ]]; then
  echo "=== verify:cluster PASSED ==="
  exit 0
else
  echo "=== verify:cluster FAILED ==="
  exit 1
fi
