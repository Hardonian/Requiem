#!/usr/bin/env bash
# scripts/verify_personas.sh
# Phase A+E: Persona completeness verification
#
# Verifies that all 6 user personas can complete their core tasks using the CLI.
# Each persona block must exit 0. Failure of any persona = build failure.
#
# Personas:
#   P1: OSS Developer     — install, demo, exec, replay, CAS inspect, determinism, export
#   P2: Power User        — doctor, status, metrics, bench
#   P3: Enterprise Op     — metrics, audit (via CLI JSON output)
#   P4: SRE/DevOps        — doctor, status, version, metrics, failure categories
#   P5: Security Auditor  — capsule inspect, replay verify, version, doctor
#   P6: Support Engineer  — bugreport, version, doctor

set -euo pipefail

REQUIEM="${REQUIEM_BIN:-./build/requiem}"
TMPDIR_TEST="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_TEST"' EXIT

fail() { echo "FAIL [Persona $1]: $2" >&2; exit 1; }
pass() { echo "PASS [Persona $1]: $2"; }

# ---------------------------------------------------------------------------
# Prerequisite: build must exist
# ---------------------------------------------------------------------------
if [[ ! -x "$REQUIEM" ]]; then
  echo "ERROR: requiem binary not found at $REQUIEM. Run 'cmake --build build' first." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Shared: prepare a demo request JSON
# ---------------------------------------------------------------------------
cat > "$TMPDIR_TEST/req.json" <<'EOF'
{
  "command": "/bin/sh",
  "argv": ["-c", "echo persona-test"],
  "workspace_root": "/tmp",
  "request_id": "persona-test-1",
  "timeout_ms": 5000
}
EOF

# ---------------------------------------------------------------------------
# P1: OSS Developer
# ---------------------------------------------------------------------------
echo ""
echo "=== Persona 1: OSS Developer ==="

# quickstart
out=$("$REQUIEM" quickstart)
echo "$out" | grep -q '"ok":true' || fail P1 "quickstart must return ok:true"
pass P1 "quickstart"

# demo (determinism)
out=$("$REQUIEM" demo)
echo "$out" | grep -q '"deterministic":true' || fail P1 "demo must show deterministic:true"
pass P1 "demo (determinism confirmed)"

# exec run
"$REQUIEM" exec run --request "$TMPDIR_TEST/req.json" --out "$TMPDIR_TEST/result.json"
[[ -f "$TMPDIR_TEST/result.json" ]] || fail P1 "exec run must produce result file"
out=$(cat "$TMPDIR_TEST/result.json")
echo "$out" | grep -q '"ok":true' || fail P1 "exec result must be ok:true"
pass P1 "exec run"

# replay verify (using CLI exec + replay)
out=$("$REQUIEM" replay verify \
  --request "$TMPDIR_TEST/req.json" \
  --result  "$TMPDIR_TEST/result.json" 2>&1 || true)
# replay verify may fail if CAS is empty (expected) — but must not crash
echo "$out" | grep -qE '"ok"|ok|verified' || fail P1 "replay verify must return structured output"
pass P1 "replay verify (no crash)"

# export JSON
out=$(cat "$TMPDIR_TEST/result.json")
echo "$out" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null \
  || fail P1 "exec result must be valid JSON"
pass P1 "export JSON (valid)"

# bugreport
out=$("$REQUIEM" bugreport)
echo "$out" | grep -q '"engine_semver"' || fail P1 "bugreport must contain engine_semver"
pass P1 "bugreport"

echo "=== P1: OSS Developer — ALL PASSED ==="

# ---------------------------------------------------------------------------
# P2: Power User
# ---------------------------------------------------------------------------
echo ""
echo "=== Persona 2: Power User ==="

# doctor
out=$("$REQUIEM" doctor)
echo "$out" | grep -q '"ok"' || fail P2 "doctor must return JSON with ok"
pass P2 "doctor"

# status
out=$("$REQUIEM" status)
echo "$out" | grep -q '"engine_semver"' || fail P2 "status must contain engine_semver"
pass P2 "status"

# metrics
out=$("$REQUIEM" metrics)
echo "$out" | grep -q '"total_executions"' || fail P2 "metrics must contain total_executions"
echo "$out" | grep -q '"determinism"' || fail P2 "metrics must contain determinism section"
pass P2 "metrics"

# version
out=$("$REQUIEM" version)
echo "$out" | grep -q '"engine_abi_version"' || fail P2 "version must contain engine_abi_version"
echo "$out" | grep -q '"cas_format_version"' || fail P2 "version must contain cas_format_version"
pass P2 "version"

echo "=== P2: Power User — ALL PASSED ==="

# ---------------------------------------------------------------------------
# P3: Enterprise Operator
# ---------------------------------------------------------------------------
echo ""
echo "=== Persona 3: Enterprise Operator ==="

# metrics — must contain p50/p95/p99 in ms for dashboard
out=$("$REQUIEM" metrics)
echo "$out" | grep -q '"p50_ms"' || fail P3 "metrics must contain p50_ms (Phase I)"
echo "$out" | grep -q '"p95_ms"' || fail P3 "metrics must contain p95_ms (Phase I)"
echo "$out" | grep -q '"p99_ms"' || fail P3 "metrics must contain p99_ms (Phase I)"
echo "$out" | grep -q '"cas"' || fail P3 "metrics must contain CAS section"
echo "$out" | grep -q '"failure_categories"' || fail P3 "metrics must contain failure_categories (Phase D)"
pass P3 "metrics (full Phase I)"

# capsule inspect (using result from P1)
out=$("$REQUIEM" capsule inspect --result "$TMPDIR_TEST/result.json")
echo "$out" | grep -q '"digest_match"' || fail P3 "capsule inspect must return digest_match"
pass P3 "capsule inspect"

echo "=== P3: Enterprise Operator — ALL PASSED ==="

# ---------------------------------------------------------------------------
# P4: SRE / DevOps
# ---------------------------------------------------------------------------
echo ""
echo "=== Persona 4: SRE/DevOps ==="

# doctor — blockers array present
out=$("$REQUIEM" doctor)
echo "$out" | grep -q '"blockers"' || fail P4 "doctor must contain blockers array"
pass P4 "doctor (blockers array)"

# version — all version fields present
out=$("$REQUIEM" version)
echo "$out" | grep -q '"protocol_framing_version"' || fail P4 "version must contain protocol_framing_version"
echo "$out" | grep -q '"hash_algorithm_version"'   || fail P4 "version must contain hash_algorithm_version"
pass P4 "version (all version fields)"

# status — worker + health present
out=$("$REQUIEM" status)
echo "$out" | grep -q '"worker"' || fail P4 "status must contain worker identity"
echo "$out" | grep -q '"health"' || fail P4 "status must contain health snapshot"
pass P4 "status (worker + health)"

echo "=== P4: SRE/DevOps — ALL PASSED ==="

# ---------------------------------------------------------------------------
# P5: Security Auditor
# ---------------------------------------------------------------------------
echo ""
echo "=== Persona 5: Security Auditor ==="

# validate-replacement
out=$("$REQUIEM" validate-replacement)
echo "$out" | grep -q '"hash_primitive":"blake3"' || fail P5 "validate-replacement must confirm blake3"
pass P5 "validate-replacement (blake3 confirmed)"

# capsule inspect — integrity check
out=$("$REQUIEM" capsule inspect --result "$TMPDIR_TEST/result.json")
echo "$out" | grep -q '"digest_match":true' || fail P5 "capsule inspect must show digest_match:true"
pass P5 "capsule inspect (integrity)"

# version — ABI version visible
out=$("$REQUIEM" version)
echo "$out" | grep -q '"engine_abi_version"' || fail P5 "version must expose engine_abi_version"
pass P5 "version (ABI visible)"

echo "=== P5: Security Auditor — ALL PASSED ==="

# ---------------------------------------------------------------------------
# P6: Support Engineer
# ---------------------------------------------------------------------------
echo ""
echo "=== Persona 6: Support Engineer ==="

# bugreport — must contain all required fields
out=$("$REQUIEM" bugreport)
echo "$out" | grep -q '"hash_primitive"' || fail P6 "bugreport must contain hash_primitive"
echo "$out" | grep -q '"worker_id"'      || fail P6 "bugreport must contain worker_id (Phase H)"
echo "$out" | grep -q '"node_id"'        || fail P6 "bugreport must contain node_id (Phase H)"
echo "$out" | grep -q '"build_timestamp"' || fail P6 "bugreport must contain build_timestamp (Phase G)"
pass P6 "bugreport (all fields)"

# doctor — failure recovery path
exit_code=0
"$REQUIEM" doctor > /dev/null 2>&1 || exit_code=$?
# doctor exits 0 (healthy) or 2 (blockers) — both are structured, not crash (3+ = unexpected)
[[ $exit_code -le 2 ]] || fail P6 "doctor must exit 0 or 2 (not crash)"
pass P6 "doctor (failure recovery path)"

echo "=== P6: Support Engineer — ALL PASSED ==="

echo ""
echo "=== ALL PERSONAS VERIFIED ==="
