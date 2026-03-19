#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-smoke-tenant}"
AUTH_TOKEN="${AUTH_TOKEN:-${REQUIEM_AUTH_SECRET:-}}"
TRACE_ID="smoke-$(date +%s)"
SMOKE_MODE="${SMOKE_MODE:-full}"
EXPECT_RUNTIME_SCOPE="${EXPECT_RUNTIME_SCOPE:-local-single-runtime}"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

request() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  local headers_file="$4"
  shift 4
  curl -sS -D "$headers_file" -o "$body_file" -w "%{http_code}" -X "$method" "$url" "$@"
}

json_field() {
  local file="$1"
  local expr="$2"
  python - "$file" "$expr" <<'PY'
import json
import sys

path = sys.argv[1]
expr = sys.argv[2].split('.')
with open(path, 'r', encoding='utf-8') as handle:
    value = json.load(handle)

for part in expr:
    if not part:
        continue
    if isinstance(value, list):
        value = value[int(part)]
    else:
        value = value[part]

if isinstance(value, (dict, list)):
    print(json.dumps(value))
else:
    print(value)
PY
}

header_value() {
  local file="$1"
  local name="$2"
  python - "$file" "$name" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
needle = sys.argv[2].lower()
for line in path.read_text(encoding='utf-8').splitlines():
    if ':' not in line:
        continue
    key, value = line.split(':', 1)
    if key.strip().lower() == needle:
        print(value.strip())
        break
PY
}

assert_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  local body="$4"
  if [[ "$actual" != "$expected" ]]; then
    echo "${label} failed: expected ${expected}, got ${actual}"
    cat "$body"
    exit 1
  fi
}

assert_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if ! grep -q "$needle" "$file"; then
    echo "${label} missing pattern: ${needle}"
    cat "$file"
    exit 1
  fi
}

require_auth_token() {
  if [[ -z "$AUTH_TOKEN" ]]; then
    echo "AUTH_TOKEN is required for full protected-route smoke checks."
    echo "Set AUTH_TOKEN explicitly, or export REQUIEM_AUTH_SECRET so the smoke script can reuse it."
    exit 1
  fi
}

echo "[smoke] BASE_URL=$BASE_URL mode=$SMOKE_MODE expected_topology=$EXPECT_RUNTIME_SCOPE"

echo "[smoke] GET /api/health"
status=$(request GET "$BASE_URL/api/health" "$workdir/health.json" "$workdir/health.headers" -H "x-trace-id: $TRACE_ID")
assert_status "$status" "200" "health" "$workdir/health.json"
assert_contains "$workdir/health.json" '"ok"' 'health body'

health_execution_model=$(header_value "$workdir/health.headers" 'x-requiem-execution-model')
[[ "$health_execution_model" == 'request-bound-same-runtime' ]] || {
  echo "health missing execution model truth header"
  cat "$workdir/health.headers"
  exit 1
}

echo "[smoke] GET /api/readiness"
status=$(request GET "$BASE_URL/api/readiness" "$workdir/readiness.json" "$workdir/readiness.headers" -H "x-trace-id: $TRACE_ID")
assert_status "$status" "200" "readiness" "$workdir/readiness.json"
readiness_topology=$(json_field "$workdir/readiness.json" 'deployment_contract.topology_mode')
[[ "$readiness_topology" == "$EXPECT_RUNTIME_SCOPE" ]] || {
  echo "unexpected readiness topology mode: $readiness_topology"
  cat "$workdir/readiness.json"
  exit 1
}

echo "[smoke] GET /api/openapi.json"
status=$(request GET "$BASE_URL/api/openapi.json" "$workdir/openapi.json" "$workdir/openapi.headers" -H "x-trace-id: $TRACE_ID")
assert_status "$status" "200" "openapi" "$workdir/openapi.json"
assert_contains "$workdir/openapi.json" '"openapi"' 'openapi body'

echo "[smoke] GET /api/engine/status without auth (expect 401/503 Problem+JSON)"
status=$(request GET "$BASE_URL/api/engine/status" "$workdir/noauth.json" "$workdir/noauth.headers" -H "x-trace-id: $TRACE_ID")
if [[ "$status" != '401' && "$status" != '503' ]]; then
  echo "unexpected unauthenticated engine status response: $status"
  cat "$workdir/noauth.json"
  exit 1
fi
assert_contains "$workdir/noauth.json" '"trace_id"' 'unauthenticated problem'
assert_contains "$workdir/noauth.json" '"title"' 'unauthenticated problem'

if [[ "$SMOKE_MODE" == 'public-only' ]]; then
  echo "[smoke] public-only mode requested; stopping after public/error-contract checks"
  exit 0
fi

require_auth_token

if [[ "$status" == '503' ]]; then
  echo "Protected-route smoke is blocked because middleware/auth topology returned 503."
  echo "This usually means NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are missing or auth wiring is unavailable."
  cat "$workdir/noauth.json"
  exit 1
fi

common_auth_headers=(
  -H "authorization: Bearer $AUTH_TOKEN"
  -H "x-tenant-id: $TENANT_ID"
  -H "x-trace-id: $TRACE_ID"
)

echo "[smoke] GET /api/budgets with invalid auth (expect 401 Problem+JSON)"
status=$(request GET "$BASE_URL/api/budgets" "$workdir/budgets-invalid-auth.json" "$workdir/budgets-invalid-auth.headers" \
  -H 'authorization: Bearer invalid-token' \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-invalid-auth")
assert_status "$status" "401" "budgets invalid auth" "$workdir/budgets-invalid-auth.json"
assert_contains "$workdir/budgets-invalid-auth.json" '"code"' 'budgets invalid auth body'
assert_contains "$workdir/budgets-invalid-auth.json" '"trace_id"' 'budgets invalid auth trace'

echo "[smoke] GET /api/budgets with auth"
status=$(request GET "$BASE_URL/api/budgets" "$workdir/budgets.json" "$workdir/budgets.headers" "${common_auth_headers[@]}")
assert_status "$status" "200" "budgets" "$workdir/budgets.json"
assert_contains "$workdir/budgets.json" '"budget.show"' 'budgets body'
[[ "$(header_value "$workdir/budgets.headers" 'x-trace-id')" != '' ]] || { echo 'budgets missing x-trace-id'; exit 1; }
[[ "$(header_value "$workdir/budgets.headers" 'x-request-id')" != '' ]] || { echo 'budgets missing x-request-id'; exit 1; }

echo "[smoke] POST /api/budgets idempotent mutation (first submission)"
status=$(request POST "$BASE_URL/api/budgets" "$workdir/budgets-post-first.json" "$workdir/budgets-post-first.headers" \
  "${common_auth_headers[@]}" \
  -H 'idempotency-key: smoke-budget-1' \
  -H 'content-type: application/json' \
  --data '{"action":"set","unit":"exec","limit":100}')
assert_status "$status" "200" "budget post" "$workdir/budgets-post-first.json"
[[ "$(header_value "$workdir/budgets-post-first.headers" 'x-requiem-idempotency-state')" == 'started' ]] || {
  echo 'budget first submission missing started idempotency state'
  cat "$workdir/budgets-post-first.headers"
  exit 1
}

echo "[smoke] POST /api/budgets idempotent mutation (replay same key)"
status=$(request POST "$BASE_URL/api/budgets" "$workdir/budgets-post-second.json" "$workdir/budgets-post-second.headers" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-replay" \
  -H 'idempotency-key: smoke-budget-1' \
  -H 'content-type: application/json' \
  --data '{"action":"set","unit":"exec","limit":100}')
assert_status "$status" "200" "budget replay" "$workdir/budgets-post-second.json"
cmp -s "$workdir/budgets-post-first.json" "$workdir/budgets-post-second.json" || {
  echo 'budget replay body mismatch'
  diff -u "$workdir/budgets-post-first.json" "$workdir/budgets-post-second.json" || true
  exit 1
}
[[ "$(header_value "$workdir/budgets-post-second.headers" 'x-idempotency-replayed')" == '1' ]] || { echo 'budget replay missing x-idempotency-replayed'; exit 1; }
[[ "$(header_value "$workdir/budgets-post-second.headers" 'x-requiem-idempotency-state')" == 'replayed' ]] || { echo 'budget replay missing replayed idempotency state'; exit 1; }

echo "[smoke] GET /api/budgets confirms read-after-write and no duplicate execution"
status=$(request GET "$BASE_URL/api/budgets" "$workdir/budgets-after.json" "$workdir/budgets-after.headers" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-after")
assert_status "$status" "200" "budget verification" "$workdir/budgets-after.json"
current_limit="$(json_field "$workdir/budgets-after.json" 'data.budget.budgets.exec.limit')"
[[ "$current_limit" == '100' ]] || {
  echo "unexpected budget exec limit: $current_limit"
  cat "$workdir/budgets-after.json"
  exit 1
}

echo "[smoke] POST /api/plans add"
status=$(request POST "$BASE_URL/api/plans" "$workdir/plan-add.json" "$workdir/plan-add.headers" \
  "${common_auth_headers[@]}" \
  -H 'idempotency-key: smoke-plan-add-1' \
  -H 'content-type: application/json' \
  --data '{"action":"add","plan_id":"smoke-plan","steps":[{"step_id":"step-1","kind":"exec","depends_on":[],"config":{"command":"echo smoke"}}]}')
assert_status "$status" "200" "plan add" "$workdir/plan-add.json"
[[ "$(header_value "$workdir/plan-add.headers" 'x-request-id')" != '' ]] || { echo 'plan add missing x-request-id'; exit 1; }
[[ "$(header_value "$workdir/plan-add.headers" 'x-trace-id')" != '' ]] || { echo 'plan add missing x-trace-id'; exit 1; }
plan_hash="$(json_field "$workdir/plan-add.json" 'data.plan.plan_hash')"
[[ -n "$plan_hash" ]] || { echo 'plan_hash missing'; cat "$workdir/plan-add.json"; exit 1; }

echo "[smoke] POST /api/plans add replay same key"
status=$(request POST "$BASE_URL/api/plans" "$workdir/plan-add-replay.json" "$workdir/plan-add-replay.headers" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-plan-add-replay" \
  -H 'idempotency-key: smoke-plan-add-1' \
  -H 'content-type: application/json' \
  --data '{"action":"add","plan_id":"smoke-plan","steps":[{"step_id":"step-1","kind":"exec","depends_on":[],"config":{"command":"echo smoke"}}]}')
assert_status "$status" "200" "plan add replay" "$workdir/plan-add-replay.json"
[[ "$(header_value "$workdir/plan-add-replay.headers" 'x-idempotency-replayed')" == '1' ]] || { echo 'plan add replay missing x-idempotency-replayed'; exit 1; }

echo "[smoke] POST /api/plans run"
status=$(request POST "$BASE_URL/api/plans" "$workdir/plan-run.json" "$workdir/plan-run.headers" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-plan-run" \
  -H 'idempotency-key: smoke-plan-run-1' \
  -H 'content-type: application/json' \
  --data "{\"action\":\"run\",\"plan_hash\":\"$plan_hash\"}")
assert_status "$status" "200" "plan run" "$workdir/plan-run.json"
[[ "$(header_value "$workdir/plan-run.headers" 'x-requiem-idempotency-state')" == 'started' ]] || { echo 'plan run missing started idempotency state'; exit 1; }
[[ "$(header_value "$workdir/plan-run.headers" 'x-request-id')" != '' ]] || { echo 'plan run missing x-request-id'; exit 1; }
[[ "$(header_value "$workdir/plan-run.headers" 'x-trace-id')" != '' ]] || { echo 'plan run missing x-trace-id'; exit 1; }
run_id="$(json_field "$workdir/plan-run.json" 'data.result.run_id')"
[[ -n "$run_id" ]] || { echo 'run_id missing'; cat "$workdir/plan-run.json"; exit 1; }

echo "[smoke] POST /api/plans run replay same key"
status=$(request POST "$BASE_URL/api/plans" "$workdir/plan-run-replay.json" "$workdir/plan-run-replay.headers" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-plan-run-replay" \
  -H 'idempotency-key: smoke-plan-run-1' \
  -H 'content-type: application/json' \
  --data "{\"action\":\"run\",\"plan_hash\":\"$plan_hash\"}")
assert_status "$status" "200" "plan run replay" "$workdir/plan-run-replay.json"
[[ "$(header_value "$workdir/plan-run-replay.headers" 'x-idempotency-replayed')" == '1' ]] || { echo 'plan run replay missing x-idempotency-replayed'; exit 1; }
replayed_run_id="$(json_field "$workdir/plan-run-replay.json" 'data.result.run_id')"
[[ "$replayed_run_id" == "$run_id" ]] || {
  echo "plan run replay returned different run_id: $replayed_run_id vs $run_id"
  diff -u "$workdir/plan-run.json" "$workdir/plan-run-replay.json" || true
  exit 1
}

echo "[smoke] GET /api/plans retrieves plan and run state"
status=$(request GET "$BASE_URL/api/plans?plan-hash=$plan_hash" "$workdir/plan-show.json" "$workdir/plan-show.headers" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-plan-show")
assert_status "$status" "200" "plan show" "$workdir/plan-show.json"
[[ "$(header_value "$workdir/plan-show.headers" 'x-request-id')" != '' ]] || { echo 'plan show missing x-request-id'; exit 1; }
[[ "$(header_value "$workdir/plan-show.headers" 'x-trace-id')" != '' ]] || { echo 'plan show missing x-trace-id'; exit 1; }
retrieved_run_id="$(json_field "$workdir/plan-show.json" 'data.runs.0.run_id')"
[[ "$retrieved_run_id" == "$run_id" ]] || {
  echo 'plan run not visible on read-after-write'
  cat "$workdir/plan-show.json"
  exit 1
}

echo "[smoke] GET /api/plans list"
status=$(request GET "$BASE_URL/api/plans?limit=10&offset=0" "$workdir/plan-list.json" "$workdir/plan-list.headers" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-plan-list")
assert_status "$status" "200" "plan list" "$workdir/plan-list.json"
list_count="$(json_field "$workdir/plan-list.json" 'data.total')"
[[ "$list_count" != '0' ]] || { echo 'plan list unexpectedly empty'; cat "$workdir/plan-list.json"; exit 1; }

echo "[smoke] PASS"
