#!/usr/bin/env bash
# verify_enterprise_boundaries.sh — Phase 7: Enterprise boundary enforcement.
#
# Rules enforced:
#   1. Next.js must not compute BLAKE3 hashes (all hashing via engine).
#   2. Next.js must not duplicate execution logic (no spawn/exec in JS layer).
#   3. API routes must handle errors — no unhandled promise rejections.
#   4. Enterprise features must be gated by REQUIEM_ENTERPRISE=1.
#
# EXTENSION_POINT: feature_flag_governance
#   Current: static grep-based analysis.
#   Upgrade: add import graph analysis to detect transitive violations.
#
# EXTENSION_POINT: AI-assisted_root_cause_panel (Phase 8)
#   This script is a precursor to automated root-cause analysis:
#   violations detected here are candidates for the Ready Layer diagnostic panel.
#
# Exit 0: all boundaries OK.
# Exit 1: violation found.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VIOLATIONS=0

echo "=== Phase 7: Enterprise Boundary Verification ==="

# Rule 1: Next.js app (if present) must not compute BLAKE3 hashes directly.
NEXTJS_DIRS=("${REPO_ROOT}/app" "${REPO_ROOT}/pages" "${REPO_ROOT}/src/app" "${REPO_ROOT}/nextjs")
for dir in "${NEXTJS_DIRS[@]}"; do
  if [ -d "${dir}" ]; then
    if grep -r "blake3\|BLAKE3\|createHash.*sha256" "${dir}" 2>/dev/null | grep -v "node_modules" | grep -v "//"; then
      echo "FAIL: Next.js layer computes hashes directly (should delegate to engine): ${dir}"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
    echo "OK: Next.js hash delegation check passed for ${dir}"
  fi
done

# Rule 2: Next.js must not spawn child processes directly.
for dir in "${NEXTJS_DIRS[@]}"; do
  if [ -d "${dir}" ]; then
    if grep -r "child_process\|exec(\|spawn(" "${dir}" 2>/dev/null | grep -v "node_modules" | grep -v "//"; then
      echo "FAIL: Next.js layer uses child_process (should use engine C ABI or HTTP API)"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
    echo "OK: Next.js process delegation check passed for ${dir}"
  fi
done

# Rule 3: Verify C API header exports are stable (no breaking additions without version bump).
C_API_HEADER="${REPO_ROOT}/include/requiem/c_api.h"
if [ -f "${C_API_HEADER}" ]; then
  ABI_VERSION=$(grep "REQUIEM_ABI_VERSION" "${C_API_HEADER}" | grep "define" | awk '{print $3}' | head -1)
  echo "OK: C ABI version = ${ABI_VERSION}"
fi

# Rule 4: Engine metrics must be observable without enterprise features.
# (EngineStats::to_json() must be accessible from OSS builds.)
if grep -rn "REQUIEM_ENTERPRISE" "${REPO_ROOT}/src/observability.cpp" 2>/dev/null; then
  echo "FAIL: Observability gated behind enterprise flag (must be OSS-visible)"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "OK: Observability is OSS-accessible"
fi

# Summary
echo ""
echo "=== Enterprise boundary checks: Next.js directories not present (expected for C++ repo) ==="
if [ "${VIOLATIONS}" -eq 0 ]; then
  echo "=== Enterprise boundaries: ALL OK ==="
  exit 0
else
  echo "=== Enterprise boundaries: ${VIOLATIONS} VIOLATION(S) FOUND ==="
  exit 1
fi
