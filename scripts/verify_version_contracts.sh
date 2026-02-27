#!/usr/bin/env bash
# scripts/verify_version_contracts.sh
# Phase G: Version evolution strategy gate
#
# Verifies:
#   1. All CLI commands emit valid JSON when polled
#   2. Version manifest contains all required fields
#   3. ABI version constant matches binary output
#   4. CAS format version constant matches binary output
#   5. No silent format drift: key field presence required

set -euo pipefail
REQUIEM="${REQUIEM_BIN:-./build/requiem}"
fail() { echo "FAIL: $1" >&2; exit 1; }

# version command — all required fields
out=$("$REQUIEM" version)
echo "$out" | grep -q '"engine_abi_version"'       || fail "version: missing engine_abi_version"
echo "$out" | grep -q '"hash_algorithm_version"'   || fail "version: missing hash_algorithm_version"
echo "$out" | grep -q '"cas_format_version"'       || fail "version: missing cas_format_version"
echo "$out" | grep -q '"protocol_framing_version"' || fail "version: missing protocol_framing_version"
echo "$out" | grep -q '"replay_log_version"'       || fail "version: missing replay_log_version"
echo "$out" | grep -q '"audit_log_version"'        || fail "version: missing audit_log_version"
echo "$out" | grep -q '"engine_semver"'             || fail "version: missing engine_semver"
echo "$out" | grep -q '"hash_primitive"'            || fail "version: missing hash_primitive"
echo "$out" | grep -q '"build_timestamp"'           || fail "version: missing build_timestamp"
echo "$out" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['engine_abi_version'] >= 1" \
  || fail "version: engine_abi_version must be >= 1"
echo "$out" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['hash_algorithm_version'] == 1" \
  || fail "version: hash_algorithm_version must be 1 (BLAKE3)"
echo "$out" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['cas_format_version'] == 2" \
  || fail "version: cas_format_version must be 2"
echo "$out" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['hash_primitive'] == 'blake3'" \
  || fail "version: hash_primitive must be blake3"

echo "PASS: version contracts verified"

# metrics — Phase I: all required metric sections present
out=$("$REQUIEM" metrics)
for field in determinism cas memory concurrency failure_categories latency; do
  echo "$out" | grep -q "\"$field\"" || fail "metrics: missing '$field' section (Phase I)"
done
for ms_field in p50_ms p95_ms p99_ms; do
  echo "$out" | grep -q "\"$ms_field\"" || fail "metrics: missing '$ms_field' (Phase I)"
done
echo "PASS: metrics completeness verified (Phase I)"

# status — worker identity fields
out=$("$REQUIEM" status)
echo "$out" | grep -q '"worker_id"'   || fail "status: missing worker_id (Phase H)"
echo "$out" | grep -q '"node_id"'     || fail "status: missing node_id (Phase H)"
echo "$out" | grep -q '"cluster_mode"' || fail "status: missing cluster_mode (Phase H)"
echo "PASS: status worker identity verified (Phase H)"

echo ""
echo "=== All version contract gates PASSED ==="
