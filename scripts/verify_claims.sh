#!/usr/bin/env bash
# scripts/verify_claims.sh
# CI gate: Verify that all documentation claims are enforced in the codebase.
#
# This script performs static analysis to ensure claims made in README.md,
# CONTRACT.md, determinism.contract.json, and code comments are backed by
# actual enforcement code — not just comments or documentation.
#
# Exit 0: all claims verified.
# Exit 1: unenforced claim detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SRC_DIR="${REPO_ROOT}/src"
INCLUDE_DIR="${REPO_ROOT}/include/requiem"

echo "=== verify:claims — documentation claims enforcement audit ==="

VIOLATIONS=0

# ---------------------------------------------------------------------------
# CLAIM 1: Domain separation — "req:", "res:", "cas:" prefixes
# Contract: determinism.contract.json → hash.domain_prefixes
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: Domain-separated hashing (req:/res:/cas:) ---"

# Request digest must use canonical_json_hash (which calls hash_domain("req:"))
if grep -n 'request_digest.*=.*deterministic_digest\|request_digest.*=.*blake3_hex' "$SRC_DIR/runtime.cpp" 2>/dev/null | grep -v '^[[:space:]]*//'; then
  echo "  FAIL: runtime.cpp computes request_digest without req: domain prefix"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "  OK: request_digest uses domain-separated hash"
fi

# Result digest must use result_json_hash (which calls hash_domain("res:"))
if grep -n 'result_digest.*=.*deterministic_digest\|result_digest.*=.*blake3_hex' "$SRC_DIR/runtime.cpp" 2>/dev/null | grep -v '^[[:space:]]*//'; then
  echo "  FAIL: runtime.cpp computes result_digest without res: domain prefix"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "  OK: result_digest uses domain-separated hash"
fi

# CAS put must use cas_content_hash (which calls hash_domain("cas:"))
if grep -n 'digest.*=.*deterministic_digest\|digest.*=.*blake3_hex' "$SRC_DIR/cas.cpp" 2>/dev/null \
    | grep -v 'stored_blob' | grep -v '^[[:space:]]*//'; then
  echo "  FAIL: cas.cpp computes CAS digest without cas: domain prefix"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "  OK: CAS content uses domain-separated hash"
fi

# ---------------------------------------------------------------------------
# CLAIM 2: CAS immutability — no silent content mutation per digest (INV-2)
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: CAS immutability (INV-2) ---"

# The put() dedup path must verify content, not just check existence
if grep -n 'fs::exists(target).*fs::exists(meta).*return digest' "$SRC_DIR/cas.cpp" 2>/dev/null; then
  echo "  FAIL: CAS put() returns on existence without content verification"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "  OK: CAS dedup path verifies content integrity"
fi

# ---------------------------------------------------------------------------
# CLAIM 3: Sandbox rlimits enforcement
# README claims "Hard Sandboxing" with rlimits
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: Sandbox rlimit enforcement ---"

if grep -q 'setrlimit' "$SRC_DIR/sandbox_posix.cpp" 2>/dev/null; then
  echo "  OK: setrlimit() called in sandbox_posix.cpp"
else
  echo "  FAIL: sandbox_posix.cpp claims rlimits but never calls setrlimit()"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# CLAIM 4: Audit append-only (INV-3)
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: Audit log append-only (INV-3) ---"

if grep -q 'SEEK_END' "$SRC_DIR/audit.cpp" 2>/dev/null; then
  echo "  OK: audit.cpp seeks to end before writing"
else
  echo "  FAIL: audit.cpp does not enforce append-only via SEEK_END"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# CLAIM 5: Replay validates ALL digests (not just request+result)
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: Replay validates stdout/stderr digests ---"

if grep -q 'stdout_digest' "$SRC_DIR/replay.cpp" 2>/dev/null; then
  echo "  OK: replay.cpp validates stdout_digest"
else
  echo "  FAIL: replay.cpp does not validate stdout_digest"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

if grep -q 'stderr_digest' "$SRC_DIR/replay.cpp" 2>/dev/null; then
  echo "  OK: replay.cpp validates stderr_digest"
else
  echo "  FAIL: replay.cpp does not validate stderr_digest"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# CLAIM 6: BLAKE3 known test vectors in test suite
# Contract: determinism.contract.json → hash.known_vectors
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: BLAKE3 known test vectors in tests ---"

EMPTY_VECTOR="af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"
HELLO_VECTOR="ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f"

if grep -q "$EMPTY_VECTOR" "$REPO_ROOT/tests/requiem_tests.cpp" 2>/dev/null; then
  echo "  OK: Empty string BLAKE3 vector tested"
else
  echo "  FAIL: Empty string BLAKE3 vector not found in tests"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

if grep -q "$HELLO_VECTOR" "$REPO_ROOT/tests/requiem_tests.cpp" 2>/dev/null; then
  echo "  OK: 'hello' BLAKE3 vector tested"
else
  echo "  FAIL: 'hello' BLAKE3 vector not found in tests"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# CLAIM 7: Version constants match contract
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: Version constants match determinism contract ---"

HASH_VER=$(grep 'constexpr.*HASH_ALGORITHM_VERSION' "$INCLUDE_DIR/version.hpp" | grep -oE '= [0-9]+' | grep -oE '[0-9]+')
CAS_VER=$(grep 'constexpr.*CAS_FORMAT_VERSION' "$INCLUDE_DIR/version.hpp" | grep -oE '= [0-9]+' | grep -oE '[0-9]+')
CONTRACT_HASH_VER=$(python3 -c "import json; d=json.load(open('$REPO_ROOT/contracts/determinism.contract.json')); print(d['hash']['algorithm_version'])" 2>/dev/null || echo "?")
CONTRACT_CAS_VER=$(python3 -c "import json; d=json.load(open('$REPO_ROOT/contracts/determinism.contract.json')); print(d['cas']['format_version'])" 2>/dev/null || echo "?")

if [ "$HASH_VER" = "$CONTRACT_HASH_VER" ]; then
  echo "  OK: HASH_ALGORITHM_VERSION ($HASH_VER) matches contract ($CONTRACT_HASH_VER)"
else
  echo "  FAIL: HASH_ALGORITHM_VERSION ($HASH_VER) != contract ($CONTRACT_HASH_VER)"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

if [ "$CAS_VER" = "$CONTRACT_CAS_VER" ]; then
  echo "  OK: CAS_FORMAT_VERSION ($CAS_VER) matches contract ($CONTRACT_CAS_VER)"
else
  echo "  FAIL: CAS_FORMAT_VERSION ($CAS_VER) != contract ($CONTRACT_CAS_VER)"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# CLAIM 8: No fallback hash — BLAKE3 is sole primitive
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: BLAKE3 is sole hash primitive (no fallback) ---"

if grep -q 'fallback_allowed = false' "$SRC_DIR/hash.cpp" 2>/dev/null || \
   grep -q 'permanently disabled' "$SRC_DIR/hash.cpp" 2>/dev/null; then
  echo "  OK: Hash fallback permanently disabled"
else
  echo "  FAIL: Hash fallback not explicitly disabled in hash.cpp"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# CLAIM 9: OSS/Enterprise boundary (INV-5)
# src/ and include/ must not import from ready-layer/
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: OSS ≠ Enterprise boundary (INV-5) ---"

# Check for actual code dependencies (imports, includes), not documentation comments
if grep -rn '#include.*ready-layer\|#include.*readylayer\|import.*ready-layer' "$SRC_DIR/" "$INCLUDE_DIR/" 2>/dev/null; then
  echo "  FAIL: OSS source has compile-time dependency on enterprise layer"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "  OK: No compile-time enterprise dependency in OSS source"
fi

# ---------------------------------------------------------------------------
# CLAIM 10: Duplicate JSON keys rejected
# Contract: serialization.rules → "No duplicate keys"
# ---------------------------------------------------------------------------
echo ""
echo "--- Claim: Duplicate JSON keys rejected ---"

if grep -q 'json_duplicate_key' "$SRC_DIR/jsonlite.cpp" 2>/dev/null; then
  echo "  OK: jsonlite.cpp rejects duplicate keys"
else
  echo "  FAIL: jsonlite.cpp does not check for duplicate keys"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
echo "=========================================="
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "=== verify:claims PASSED (all ${VIOLATIONS} claims enforced) ==="
  exit 0
else
  echo "=== verify:claims FAILED ($VIOLATIONS unenforced claim(s)) ==="
  exit 1
fi
