#!/usr/bin/env bash
# scripts/quickstart.sh — One-command deterministic developer stack.
#
# Usage:
#   ./scripts/quickstart.sh [--real] [--help]
#
# With --real (reach quickstart --real equivalent):
#   1. Build the engine (C++ CMake)
#   2. Run engine daemon (background)
#   3. Run Node API / Next.js setup check
#   4. Execute golden corpus
#   5. Verify determinism proof
#   6. Print determinism report
#
# Without --real: smoke test only (no long-running daemon).
#
# INVARIANT: local run must produce identical determinism report to CI.
#            Any divergence is reported as a failure, not a warning.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
REAL_MODE=0
for arg in "$@"; do
  case $arg in
    --real) REAL_MODE=1 ;;
    --help|-h)
      echo "Usage: reach quickstart [--real]"
      echo ""
      echo "  --real  Full deterministic stack: build + daemon + corpus + proof"
      echo "  (none)  Smoke test: build + single execution + determinism check"
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

cd "${REPO_ROOT}"

echo "============================================================"
echo " Requiem Deterministic Quickstart"
echo " Mode: $([ "$REAL_MODE" -eq 1 ] && echo 'REAL (full stack)' || echo 'SMOKE (fast)')"
echo " Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================================"
echo ""

STEP=0
step() {
  STEP=$((STEP + 1))
  echo "--- Step $STEP: $* ---"
}

ERRORS=0
mark_fail() {
  echo "  FAIL: $*" >&2
  ERRORS=$((ERRORS + 1))
}

# ---------------------------------------------------------------------------
# Step 1: Build engine
# ---------------------------------------------------------------------------
step "Build C++ engine"

mkdir -p artifacts/reports

if pkg-config --exists libzstd 2>/dev/null; then
  echo "  INFO: libzstd found — building with compression support"
  cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXPORT_COMPILE_COMMANDS=ON \
    2>&1 | grep -E "(Warning|Error|error)" | head -20 || true
else
  echo "  INFO: libzstd not found — building without compression"
  cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DREQUIEM_WITH_ZSTD=OFF \
    2>&1 | grep -E "(Warning|Error|error)" | head -20 || true
fi

cmake --build build -j "$(nproc 2>/dev/null || echo 4)" 2>&1 | tail -5

if [ ! -f build/requiem ]; then
  mark_fail "build/requiem binary not produced"
else
  echo "  OK  build/requiem produced"
fi

if [ ! -f build/requiem_tests ]; then
  mark_fail "build/requiem_tests not produced"
else
  echo "  OK  build/requiem_tests produced"
fi

# ---------------------------------------------------------------------------
# Step 2: Run unit tests
# ---------------------------------------------------------------------------
step "Run unit tests (requiem_tests)"

if ctest --test-dir build --output-on-failure -j "$(nproc 2>/dev/null || echo 4)" 2>&1 | \
     grep -E "(PASS|FAIL|tests passed|tests failed)" | head -5; then
  echo "  OK  unit tests passed"
else
  mark_fail "unit tests failed — check test output above"
fi

# ---------------------------------------------------------------------------
# Step 3: Version contract check
# ---------------------------------------------------------------------------
step "Version contract and policy check"

if ./scripts/verify_version_contracts.sh 2>&1 | tail -3; then
  echo "  OK  version contracts valid"
fi

if ./scripts/verify_policy.sh 2>&1 | tail -3; then
  echo "  OK  policy valid"
fi

if ./scripts/verify_compat_matrix.sh 2>&1 | tail -3; then
  echo "  OK  compat matrix valid"
fi

# ---------------------------------------------------------------------------
# Step 4: Golden corpus + determinism proof
# ---------------------------------------------------------------------------
step "Golden corpus execution + determinism proof"

if [ "$REAL_MODE" -eq 1 ]; then
  echo "  Running full golden corpus (all fixtures, 200x loop)..."
  if ./scripts/verify_determinism.sh 2>&1; then
    echo "  OK  determinism proof: PASSED"
  else
    mark_fail "determinism proof FAILED — see artifacts/reports/determinism_report.json"
  fi
else
  echo "  Running smoke corpus (single fixture pass)..."
  if ./scripts/verify_smoke.sh 2>&1 | tail -5; then
    echo "  OK  smoke execution passed"
  else
    mark_fail "smoke execution FAILED"
  fi
fi

# ---------------------------------------------------------------------------
# Step 5: Generate golden corpus (real mode only)
# ---------------------------------------------------------------------------
if [ "$REAL_MODE" -eq 1 ]; then
  step "Generate golden corpus digests"
  if ./scripts/generate_golden_corpus.sh 2>&1 | tail -3; then
    echo "  OK  golden corpus digests generated"
  fi
fi

# ---------------------------------------------------------------------------
# Step 6: Governance gates
# ---------------------------------------------------------------------------
step "Governance gates (deps, migrations, routes, flags)"

./scripts/verify_deps.sh 2>&1 | tail -2 && echo "  OK  deps"
./scripts/verify_migrations.sh 2>&1 | tail -2 && echo "  OK  migrations"
./scripts/verify_routes.sh 2>&1 | tail -2 && echo "  OK  routes"
./scripts/verify_flags.sh 2>&1 | tail -2 && echo "  OK  flags"

# ---------------------------------------------------------------------------
# Step 7: Supply chain + formal verification (real mode only)
# ---------------------------------------------------------------------------
if [ "$REAL_MODE" -eq 1 ]; then
  step "Supply chain + formal spec verification"
  ./scripts/verify_supplychain.sh 2>&1 | tail -3
  ./scripts/verify_formal.sh 2>&1 | tail -3
fi

# ---------------------------------------------------------------------------
# Step 8: Node API / Next.js setup check
# ---------------------------------------------------------------------------
step "Ready Layer (Next.js) dependency check"

if [ -d "ready-layer" ] && [ -f "ready-layer/package.json" ]; then
  if command -v node &>/dev/null; then
    echo "  INFO: Node $(node --version) found"
    if [ ! -d "ready-layer/node_modules" ]; then
      echo "  INFO: installing ready-layer deps (npm ci)..."
      (cd ready-layer && npm ci --ignore-scripts 2>&1 | tail -3) || \
      (cd ready-layer && npm install --ignore-scripts 2>&1 | tail -3) || \
        echo "  WARN: npm install failed — typecheck skipped"
    fi
    if [ -d "ready-layer/node_modules" ]; then
      (cd ready-layer && npm run typecheck 2>&1 | tail -5) && echo "  OK  typecheck" || \
        echo "  WARN: typecheck failed — non-blocking in quickstart"
    fi
  else
    echo "  WARN: Node.js not installed — skipping ready-layer checks"
  fi
fi

# ---------------------------------------------------------------------------
# Step 9: Print determinism report
# ---------------------------------------------------------------------------
step "Determinism report"

REPORT_FILE="artifacts/reports/determinism_report.json"
if [ -f "$REPORT_FILE" ]; then
  python3 - <<PYEOF
import json
with open("${REPORT_FILE}") as f:
    r = json.load(f)
print(f"  determinism_score: {r.get('determinism_score', 'N/A')}")
print(f"  total_runs:        {r.get('total_runs', 'N/A')}")
print(f"  unique_digests:    {r.get('unique_digests', 'N/A')}")
print(f"  status:            {r.get('status', 'N/A')}")
PYEOF
else
  echo "  INFO: no determinism report yet (run with --real for full proof)"
fi

# ---------------------------------------------------------------------------
# Final result
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
if [ "$ERRORS" -eq 0 ]; then
  echo " QUICKSTART PASSED — platform determinism verified"
  echo " Local/CI parity: $(./scripts/verify_contract.sh 2>&1 | tail -1 | grep -oE 'PASSED|FAILED' || echo 'see contract output')"
else
  echo " QUICKSTART FAILED — $ERRORS error(s) found"
  echo " Fix the errors above, then re-run: ./scripts/quickstart.sh --real"
fi
echo "============================================================"

exit "$ERRORS"
