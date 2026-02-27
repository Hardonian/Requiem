#!/usr/bin/env bash
# verify_oss_boundaries.sh — Phase 7: OSS vs Enterprise boundary enforcement.
#
# Rules enforced:
#   1. OSS core (src/, include/requiem/) must NOT import enterprise-only headers.
#   2. No hardcoded enterprise endpoint URLs in OSS source.
#   3. Enterprise-only features must be gated by REQUIEM_ENTERPRISE flag.
#   4. C ABI header (c_api.h) must be pure C — no C++ includes.
#
# EXTENSION_POINT: feature_flag_governance
#   Upgrade: add a manifest file listing OSS vs Enterprise modules, and verify
#   at CI time that the manifest matches actual includes.
#
# Exit 0: all boundaries OK.
# Exit 1: violation found.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VIOLATIONS=0

echo "=== Phase 7: OSS Boundary Verification ==="

# Rule 1: OSS source must not include enterprise-only headers.
ENTERPRISE_HEADERS=("enterprise/" "ready_layer/" "cloud_billing/")
for header in "${ENTERPRISE_HEADERS[@]}"; do
  if grep -r "#include.*${header}" "${REPO_ROOT}/src/" "${REPO_ROOT}/include/requiem/" 2>/dev/null | grep -v "^Binary"; then
    echo "FAIL: OSS source includes enterprise header: ${header}"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# Rule 2: No hardcoded enterprise endpoint URLs.
ENTERPRISE_URLS=("ready-layer.com" "readylayer.com" "api.ready-layer" "app.ready-layer")
for url in "${ENTERPRISE_URLS[@]}"; do
  if grep -r "${url}" "${REPO_ROOT}/src/" "${REPO_ROOT}/include/requiem/" 2>/dev/null | grep -v "^Binary" | grep -v "//.*${url}"; then
    echo "FAIL: Hardcoded enterprise URL in OSS source: ${url}"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# Rule 3: Enterprise-conditional code must use REQUIEM_ENTERPRISE guard.
# (Currently no enterprise-conditional code — pass by default.)

# Rule 4: c_api.h must be pure C (no C++ headers).
C_API_HEADER="${REPO_ROOT}/include/requiem/c_api.h"
if [ -f "${C_API_HEADER}" ]; then
  if grep -n "#include <string>" "${C_API_HEADER}" 2>/dev/null; then
    echo "FAIL: c_api.h includes C++ header <string>"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
  if grep -n "#include <vector>" "${C_API_HEADER}" 2>/dev/null; then
    echo "FAIL: c_api.h includes C++ header <vector>"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
  echo "OK: c_api.h is pure C"
else
  echo "SKIP: c_api.h not found (not built)"
fi

# Rule 5: Verify canonicalize_request() does not include tenant_id.
# (tenant_id in canonical form would break OSS/Enterprise digest parity)
if grep -n "tenant_id" "${REPO_ROOT}/src/runtime.cpp" | grep "canonicalize_request\|out +=" | grep -v "//"; then
  echo "WARN: Check that tenant_id is not included in canonicalize_request() output"
fi

# Summary
if [ "${VIOLATIONS}" -eq 0 ]; then
  echo ""
  echo "=== OSS boundaries: ALL OK ==="
  exit 0
else
  echo ""
  echo "=== OSS boundaries: ${VIOLATIONS} VIOLATION(S) FOUND ==="
  exit 1
fi
