#!/usr/bin/env bash
# scripts/verify_boundaries.sh
# Phase 3: Unified boundary check — OSS + Enterprise + Next.js layer isolation.
# Runs verify_oss_boundaries.sh and verify_enterprise_boundaries.sh as sub-checks,
# then adds additional static import-graph checks for the Next.js layer.
#
# Exit 0: all boundaries OK.
# Exit 1: any violation found.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== verify:boundaries ==="
VIOLATIONS=0

# ---------------------------------------------------------------------------
# Sub-check 1: OSS boundaries
# ---------------------------------------------------------------------------
echo ""
echo "--- OSS boundaries ---"
if ! "${SCRIPT_DIR}/verify_oss_boundaries.sh"; then
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# Sub-check 2: Enterprise boundaries
# ---------------------------------------------------------------------------
echo ""
echo "--- Enterprise boundaries ---"
if ! "${SCRIPT_DIR}/verify_enterprise_boundaries.sh"; then
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# Sub-check 3: Next.js must not import engine internals
# ---------------------------------------------------------------------------
echo ""
echo "--- Next.js → engine internal import check ---"
NEXTJS_SRC="${REPO_ROOT}/ready-layer/src"
ENGINE_INTERNALS=("requiem/runtime" "requiem/cas" "requiem/worker" "requiem/replay" "requiem/sandbox")
if [ -d "$NEXTJS_SRC" ]; then
  for internal in "${ENGINE_INTERNALS[@]}"; do
    if grep -r "import.*['\"].*${internal}" "$NEXTJS_SRC" 2>/dev/null | grep -v "node_modules"; then
      echo "FAIL: Next.js imports engine internal: ${internal}"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
  echo "OK: No direct engine internal imports in Next.js layer"
fi

# ---------------------------------------------------------------------------
# Sub-check 4: ready-layer must not reference C headers directly
# ---------------------------------------------------------------------------
echo ""
echo "--- Next.js → C header reference check ---"
if [ -d "$NEXTJS_SRC" ]; then
  if grep -r '#include.*\.h[">]' "$NEXTJS_SRC" 2>/dev/null | grep -v "node_modules"; then
    echo "FAIL: Next.js layer contains C #include directives"
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    echo "OK: No C #include in Next.js layer"
  fi
fi

# ---------------------------------------------------------------------------
# Sub-check 5: scripts/ must not hardcode production secrets
# ---------------------------------------------------------------------------
echo ""
echo "--- Script secret scan ---"
# Exclude this script itself to avoid pattern definitions triggering false positives
SELF="$(realpath "${BASH_SOURCE[0]}")"
SECRET_VIOLATIONS=0
if grep -r 'REQUIEM_AUTH_SECRET=[A-Za-z0-9_]' "${REPO_ROOT}/scripts/" 2>/dev/null \
    | grep -v "^${SELF}:" | grep -v "^Binary"; then
  echo "  FAIL: Hardcoded REQUIEM_AUTH_SECRET value in scripts/"
  SECRET_VIOLATIONS=$((SECRET_VIOLATIONS + 1))
fi
if [ "$SECRET_VIOLATIONS" -gt 0 ]; then
  VIOLATIONS=$((VIOLATIONS + SECRET_VIOLATIONS))
else
  echo "  OK: No hardcoded secrets in scripts/"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "=== verify:boundaries PASSED ==="
  exit 0
else
  echo "=== verify:boundaries FAILED ($VIOLATIONS sub-check(s) failed) ==="
  exit 1
fi
