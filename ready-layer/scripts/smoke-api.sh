#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-smoke-tenant}"
AUTH_TOKEN="${AUTH_TOKEN:-${REQUIEM_AUTH_SECRET:-}}"
TRACE_ID="smoke-$(date +%s)"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

request() {
  local method="$1"
  local url="$2"
  local outfile="$3"
  shift 3
  local status
  status=$(curl -sS -o "$outfile" -w "%{http_code}" -X "$method" "$url" "$@")
  echo "$status"
}

json_field() {
  local file="$1"
  local expr="$2"
  python - "$file" "$expr" <<'PY'
import json
import sys

path = sys.argv[1]
expr = sys.argv[2].split(".")
with open(path, "r", encoding="utf-8") as handle:
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

echo "[smoke] BASE_URL=$BASE_URL"

echo "[smoke] GET /api/health"
status=$(request GET "$BASE_URL/api/health" "$workdir/health.json" -H "x-trace-id: $TRACE_ID")
[[ "$status" == "200" ]] || { echo "health failed: $status"; cat "$workdir/health.json"; exit 1; }
grep -q '"ok"' "$workdir/health.json"

echo "[smoke] GET /api/openapi.json"
status=$(request GET "$BASE_URL/api/openapi.json" "$workdir/openapi.json" -H "x-trace-id: $TRACE_ID")
[[ "$status" == "200" ]] || { echo "openapi failed: $status"; cat "$workdir/openapi.json"; exit 1; }
grep -q '"openapi"' "$workdir/openapi.json"

echo "[smoke] GET /api/engine/status without auth (expect 401 Problem+JSON)"
status=$(request GET "$BASE_URL/api/engine/status" "$workdir/noauth.json" -H "x-trace-id: $TRACE_ID")
if [[ "$status" != "401" && "$status" != "503" ]]; then
  echo "unexpected status: $status"
  cat "$workdir/noauth.json"
  exit 1
fi
grep -q '"trace_id"' "$workdir/noauth.json"
grep -q '"title"' "$workdir/noauth.json"

if [[ "$status" == "503" ]]; then
  echo "[smoke] Auth service unavailable in this environment; skipping protected-route checks"
  echo "[smoke] PASS (public + error contract checks)"
  exit 0
fi

if [[ -z "$AUTH_TOKEN" ]]; then
  echo "AUTH_TOKEN is required for protected-route smoke checks."
  echo "Set AUTH_TOKEN explicitly, or export REQUIEM_AUTH_SECRET so the smoke script can reuse it."
  exit 1
fi

echo "[smoke] GET /api/budgets with auth"
status=$(request GET "$BASE_URL/api/budgets" "$workdir/budgets.json" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: $TRACE_ID")
[[ "$status" == "200" ]] || { echo "budgets failed: $status"; cat "$workdir/budgets.json"; exit 1; }
grep -q '"budget.show"' "$workdir/budgets.json"

echo "[smoke] POST /api/budgets idempotent mutation (first submission)"
status=$(request POST "$BASE_URL/api/budgets" "$workdir/budgets-post-first.json" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: $TRACE_ID" \
  -H "idempotency-key: smoke-budget-1" \
  -H "content-type: application/json" \
  --data '{"action":"set","unit":"exec","limit":100}')
[[ "$status" == "200" ]] || { echo "budget post failed: $status"; cat "$workdir/budgets-post-first.json"; exit 1; }

echo "[smoke] POST /api/budgets idempotent mutation (replay same key)"
status=$(request POST "$BASE_URL/api/budgets" "$workdir/budgets-post-second.json" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-replay" \
  -H "idempotency-key: smoke-budget-1" \
  -H "content-type: application/json" \
  --data '{"action":"set","unit":"exec","limit":100}')
[[ "$status" == "200" ]] || { echo "budget replay failed: $status"; cat "$workdir/budgets-post-second.json"; exit 1; }
cmp -s "$workdir/budgets-post-first.json" "$workdir/budgets-post-second.json" || {
  echo "budget replay body mismatch"
  diff -u "$workdir/budgets-post-first.json" "$workdir/budgets-post-second.json" || true
  exit 1
}

echo "[smoke] GET /api/budgets confirms read-after-write"
status=$(request GET "$BASE_URL/api/budgets" "$workdir/budgets-after.json" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-after")
[[ "$status" == "200" ]] || { echo "budget verification failed: $status"; cat "$workdir/budgets-after.json"; exit 1; }
current_limit="$(json_field "$workdir/budgets-after.json" "data.budget.limit.exec")"
[[ "$current_limit" == "100" ]] || {
  echo "unexpected budget exec limit: $current_limit"
  cat "$workdir/budgets-after.json"
  exit 1
}

echo "[smoke] POST /api/plans add"
status=$(request POST "$BASE_URL/api/plans" "$workdir/plan-add.json" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-plan-add" \
  -H "idempotency-key: smoke-plan-add-1" \
  -H "content-type: application/json" \
  --data '{"action":"add","plan_id":"smoke-plan","steps":[{"step_id":"step-1","kind":"exec","depends_on":[],"config":{"command":"echo smoke"}}]}')
[[ "$status" == "200" ]] || { echo "plan add failed: $status"; cat "$workdir/plan-add.json"; exit 1; }
plan_hash="$(json_field "$workdir/plan-add.json" "data.plan.plan_hash")"
[[ -n "$plan_hash" ]] || { echo "plan_hash missing"; cat "$workdir/plan-add.json"; exit 1; }

echo "[smoke] POST /api/plans run"
status=$(request POST "$BASE_URL/api/plans" "$workdir/plan-run.json" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-plan-run" \
  -H "idempotency-key: smoke-plan-run-1" \
  -H "content-type: application/json" \
  --data "{\"action\":\"run\",\"plan_hash\":\"$plan_hash\"}")
[[ "$status" == "200" ]] || { echo "plan run failed: $status"; cat "$workdir/plan-run.json"; exit 1; }
run_id="$(json_field "$workdir/plan-run.json" "data.result.run_id")"
[[ -n "$run_id" ]] || { echo "run_id missing"; cat "$workdir/plan-run.json"; exit 1; }

echo "[smoke] GET /api/plans retrieves plan and run state"
status=$(request GET "$BASE_URL/api/plans?plan-hash=$plan_hash" "$workdir/plan-show.json" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: ${TRACE_ID}-plan-show")
[[ "$status" == "200" ]] || { echo "plan show failed: $status"; cat "$workdir/plan-show.json"; exit 1; }
retrieved_run_id="$(json_field "$workdir/plan-show.json" "data.runs.0.run_id")"
[[ "$retrieved_run_id" == "$run_id" ]] || {
  echo "plan run not visible on read-after-write"
  cat "$workdir/plan-show.json"
  exit 1
}

echo "[smoke] PASS"
