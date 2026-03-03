#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-smoke-tenant}"
AUTH_TOKEN="${AUTH_TOKEN:-smoke-token}"
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
[[ "$status" == "401" ]] || { echo "unexpected status: $status"; cat "$workdir/noauth.json"; exit 1; }
grep -q '"trace_id"' "$workdir/noauth.json"
grep -q '"title"' "$workdir/noauth.json"

echo "[smoke] GET /api/budgets with auth"
status=$(request GET "$BASE_URL/api/budgets" "$workdir/budgets.json" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: $TRACE_ID")
[[ "$status" == "200" ]] || { echo "budgets failed: $status"; cat "$workdir/budgets.json"; exit 1; }
grep -q '"budget.show"' "$workdir/budgets.json"

echo "[smoke] POST /api/budgets idempotent mutation"
status=$(request POST "$BASE_URL/api/budgets" "$workdir/budgets-post.json" \
  -H "authorization: Bearer $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-trace-id: $TRACE_ID" \
  -H "idempotency-key: smoke-budget-1" \
  -H "content-type: application/json" \
  --data '{"action":"set","unit":"exec","limit":100}')
[[ "$status" == "200" ]] || { echo "budget post failed: $status"; cat "$workdir/budgets-post.json"; exit 1; }

echo "[smoke] PASS"
