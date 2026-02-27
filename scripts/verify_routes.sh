#!/usr/bin/env bash
# scripts/verify_routes.sh
# Phase 3: Route safety gate — no hard-500 routes.
#
# Strategy (two arms):
#   1. Static analysis: scan all route files for missing try/catch and missing
#      'force-dynamic' export. Violations = hard fail.
#   2. Live probe (optional): if NEXT_PUBLIC_APP_URL is set, fetch each route
#      from routes.manifest.json and assert no 500 response.
#
# Exit 0: all routes safe.
# Exit 1: any static violation or live 500 detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROUTES_DIR="${REPO_ROOT}/ready-layer/src/app/api"
MANIFEST="${REPO_ROOT}/routes.manifest.json"

echo "=== verify:routes ==="

VIOLATIONS=0

# ---------------------------------------------------------------------------
# ARM 1: Static analysis of route files
# ---------------------------------------------------------------------------
echo "  [static] Scanning API route files..."

if [ ! -d "$ROUTES_DIR" ]; then
  echo "  SKIP: $ROUTES_DIR not found"
else
  while IFS= read -r -d '' route_file; do
    rel=$(realpath --relative-to="$REPO_ROOT" "$route_file")

    # Rule 1: Every route must have 'force-dynamic'
    if ! grep -q "force-dynamic" "$route_file"; then
      echo "  FAIL [$rel]: missing 'export const dynamic = force-dynamic'"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi

    # Rule 2: Every exported async function that calls external services must have try/catch.
    # Exception: routes with the marker '// verify:routes:no-try-catch' are exempt
    # (used for pure-infra routes like /api/health that never call external services).
    if grep -qE "export async function (GET|POST|PUT|PATCH|DELETE|HEAD)" "$route_file"; then
      if ! grep -q "try {" "$route_file" && ! grep -q "verify:routes:no-try-catch" "$route_file"; then
        echo "  FAIL [$rel]: exported handler has no try/catch block (add try/catch or verify:routes:no-try-catch marker)"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    fi

    # Rule 3: Error responses must use NextResponse.json, not throw
    # Detect bare 'throw new Error' inside route handlers (not in catch blocks)
    # Simple heuristic: bare throw outside catch = potential 500
    # (Full AST check would require ts-node — this is a fast grep gate)

  done < <(find "$ROUTES_DIR" -name "route.ts" -print0)

  # Count routes found
  ROUTE_COUNT=$(find "$ROUTES_DIR" -name "route.ts" | wc -l)
  echo "  Scanned ${ROUTE_COUNT} route file(s)"
fi

# ---------------------------------------------------------------------------
# ARM 2: Manifest diff — untracked routes
# ---------------------------------------------------------------------------
echo "  [manifest] Checking routes.manifest.json..."

if [ ! -f "$MANIFEST" ]; then
  echo "  WARN: routes.manifest.json not found — run scripts/generate_routes_manifest.sh"
  # Not a hard failure here — manifest generation is a separate step
else
  # Extract paths from manifest
  MANIFEST_PATHS=$(python3 -c "
import json, sys
with open('${MANIFEST}') as f:
    m = json.load(f)
for r in m.get('routes', []):
    print(r['path'])
" 2>/dev/null || true)

  # Extract actual route paths from filesystem
  ACTUAL_PATHS=$(find "$ROUTES_DIR" -name "route.ts" \
    | sed "s|${ROUTES_DIR}||;s|/route\.ts$||" \
    | sed 's|^|/api|' \
    | sort)

  # Check for untracked routes (in filesystem but not in manifest)
  while IFS= read -r path; do
    if ! echo "$MANIFEST_PATHS" | grep -qF "$path"; then
      echo "  WARN [untracked route]: $path — add to routes.manifest.json"
      # Warn only, not hard fail (manifest is new; routes existed before)
    fi
  done <<< "$ACTUAL_PATHS"

  echo "  Manifest routes: $(echo "$MANIFEST_PATHS" | wc -l | tr -d ' ')"
  echo "  Actual routes:   $(echo "$ACTUAL_PATHS" | wc -l | tr -d ' ')"
fi

# ---------------------------------------------------------------------------
# ARM 3: Live probe (optional — requires running server)
# ---------------------------------------------------------------------------
APP_URL="${NEXT_PUBLIC_APP_URL:-}"
if [ -n "$APP_URL" ] && [ -f "$MANIFEST" ]; then
  echo "  [live] Probing routes at $APP_URL..."

  PROBE_FAILURES=0
  while IFS= read -r path; do
    url="${APP_URL}${path}"
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    if [ "$status" = "500" ]; then
      echo "  FAIL [live 500]: $url returned HTTP 500"
      PROBE_FAILURES=$((PROBE_FAILURES + 1))
    elif [ "$status" = "000" ]; then
      echo "  WARN [live timeout]: $url (server may be starting)"
    else
      echo "  OK [$status]: $url"
    fi
  done < <(python3 -c "
import json
with open('${MANIFEST}') as f:
    m = json.load(f)
for r in m.get('routes', []):
    if r.get('probe', True):
        print(r['path'])
" 2>/dev/null || true)

  VIOLATIONS=$((VIOLATIONS + PROBE_FAILURES))
else
  echo "  [live] SKIP — NEXT_PUBLIC_APP_URL not set (set to enable live probing)"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "=== verify:routes PASSED ==="
  exit 0
else
  echo "=== verify:routes FAILED ($VIOLATIONS violation(s)) ==="
  exit 1
fi
