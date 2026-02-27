#!/usr/bin/env bash
# run_production_hardening.sh — Production hardening orchestration.
#
# Runs all Phases 0-7 and produces a final summary.
# Exit 0 = all phases GREEN.
# Exit 1 = one or more phases FAILED.
#
# Usage:
#   ./scripts/run_production_hardening.sh [--skip-slow]
#
# --skip-slow: skip stress_harness (10K/1K), shadow_runner (2K), memory_harness (5K)
#              for rapid CI. Full run is required for promotion gate.

set -euo pipefail

SKIP_SLOW=0
for arg in "$@"; do
  if [ "$arg" = "--skip-slow" ]; then SKIP_SLOW=1; fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$REPO_ROOT/build"
REPORTS_DIR="$REPO_ROOT/artifacts/reports"

cd "$REPO_ROOT"

echo "================================================================"
echo "  REQUIEM PRODUCTION HARDENING — PHASE 0-7"
echo "================================================================"

# ---- Phase 0: Baseline build + tests ------------------------------------
echo ""
echo "PHASE 0: Baseline build + lint + tests"

if pkg-config --exists libzstd 2>/dev/null; then
  cmake -S . -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
else
  cmake -S . -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release -DREQUIEM_WITH_ZSTD=OFF -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
fi
cmake --build "$BUILD_DIR" -j"$(nproc)"

echo "  [Phase 0] Build: PASS"

# Run baseline tests (fast).
ctest --test-dir "$BUILD_DIR" -L "^$" --output-on-failure --exclude-regex "stress_harness|shadow_runner|memory_harness"
echo "  [Phase 0] Tests (fast): PASS"

# Lint check.
if bash "$SCRIPT_DIR/verify_lint.sh" 2>/dev/null; then
  echo "  [Phase 0] Lint: PASS"
else
  echo "  [Phase 0] Lint: WARN (non-blocking)"
fi

# Hash backend verify.
bash "$SCRIPT_DIR/verify_hash_backend.sh"
echo "  [Phase 0] Hash backend (BLAKE3 vendored): PASS"

# ---- Helper: run a harness and check exit code --------------------------

PHASES_PASSED=0
PHASES_FAILED=0
FAILED_PHASES=()

run_phase() {
  local phase="$1"
  local binary="$2"
  shift 2

  echo ""
  echo "PHASE ${phase}: $(basename "$binary")"
  if "$BUILD_DIR/$binary" "$@"; then
    echo "  [Phase ${phase}] PASS"
    PHASES_PASSED=$((PHASES_PASSED + 1))
  else
    echo "  [Phase ${phase}] FAIL"
    PHASES_FAILED=$((PHASES_FAILED + 1))
    FAILED_PHASES+=("Phase ${phase}: ${binary}")
  fi
}

# ---- Phase 4: Security gauntlet (fast — run first for fast feedback) ----
run_phase "4" "security_gauntlet"

# ---- Phase 5: Recovery harness (fast) ------------------------------------
run_phase "5" "recovery_harness"

# ---- Phase 3: Billing parity (fast) --------------------------------------
run_phase "3" "billing_harness"

# ---- Phase 7: Protocol harness (fast) ------------------------------------
run_phase "7" "protocol_harness"

# ---- Slow phases (skip if --skip-slow) -----------------------------------
if [ "$SKIP_SLOW" -eq 0 ]; then
  run_phase "1" "stress_harness"
  run_phase "2" "shadow_runner"
  run_phase "6" "memory_harness"
else
  echo ""
  echo "PHASE 1 (stress_harness): SKIPPED (--skip-slow)"
  echo "PHASE 2 (shadow_runner):  SKIPPED (--skip-slow)"
  echo "PHASE 6 (memory_harness): SKIPPED (--skip-slow)"
fi

# ---- Summary report -------------------------------------------------------
echo ""
echo "================================================================"
echo "  PRODUCTION HARDENING SUMMARY"
echo "================================================================"
echo "  Phases passed: $PHASES_PASSED"
echo "  Phases failed: $PHASES_FAILED"

for f in "$FAILED_PHASES[@]"; do
  echo "  FAILED: $f"
done

# Verify report files exist.
echo ""
echo "  Reports produced:"
for report in \
    "$REPORTS_DIR/CLOUD_SECURITY_REPORT.json" \
    "$REPORTS_DIR/CLOUD_RECOVERY_REPORT.json" \
    "$REPORTS_DIR/BILLING_PARITY_REPORT.json" \
    "$REPORTS_DIR/CLOUD_PROTOCOL_REPORT.json"; do
  if [ -f "$report" ]; then
    pass_val=$(grep -o '"pass":true' "$report" | head -1 || echo "")
    status="MISSING_pass_field"
    if [ -n "$pass_val" ]; then status="PASS"; else status="FAIL"; fi
    echo "    $(basename "$report"): $status"
  else
    echo "    $(basename "$report"): NOT_FOUND"
  fi
done

if [ "$SKIP_SLOW" -eq 0 ]; then
  for report in \
      "$REPORTS_DIR/CLOUD_STRESS_REPORT.json" \
      "$REPORTS_DIR/CLOUD_DETERMINISM_REPORT.json" \
      "$REPORTS_DIR/CLOUD_MEMORY_REPORT.json"; do
    if [ -f "$report" ]; then
      pass_val=$(grep -o '"pass":true' "$report" | head -1 || echo "")
      status="FAIL"
      if [ -n "$pass_val" ]; then status="PASS"; fi
      echo "    $(basename "$report"): $status"
    else
      echo "    $(basename "$report"): NOT_FOUND"
    fi
  done
fi

echo ""
if [ "$PHASES_FAILED" -eq 0 ]; then
  echo "  OVERALL: GREEN"
  exit 0
else
  echo "  OVERALL: RED ($PHASES_FAILED phases failed)"
  exit 1
fi
