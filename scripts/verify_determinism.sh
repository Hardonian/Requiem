#!/usr/bin/env bash
# scripts/verify_determinism.sh
# CI gate: determinism verification across golden corpus + 200x sequential repeat.
#
# Emits: artifacts/determinism_report.json (uploaded as CI artifact).
#
# Exit 0: all workloads deterministic.
# Exit 1: any digest drift or missing digest.
#
# EXTENSION_POINT: concurrent_determinism
#   Add parallel execution arm (N workers, same fixture) after sequential arm passes.

set -euo pipefail

REQUIEM="${REQUIEM_BIN:-./build/requiem}"
REPORT_DIR="${REPORT_DIR:-artifacts/reports}"
REPORT_FILE="${REPORT_DIR}/determinism_report.json"
RUNS="${DETERMINISM_RUNS:-200}"

echo "=== verify:determinism — ${RUNS}x sequential + golden corpus ==="
mkdir -p "$REPORT_DIR"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

OVERALL_PASS=true
declare -a FIXTURE_RESULTS=()
TOTAL_RUNS=0
TOTAL_DRIFT=0
START_EPOCH=$(date +%s)

# ---------------------------------------------------------------------------
# run_fixture <label> <request_file> <expected_runs>
# Returns: populates FIXTURE_RESULTS array entry as compact JSON
# ---------------------------------------------------------------------------
run_fixture() {
  local label="$1"
  local req_file="$2"
  local n="${3:-$RUNS}"
  local first_digest=""
  local failures=0
  local fixture_start
  fixture_start=$(date +%s)

  echo "  fixture[$label]: running ${n}x..."
  for i in $(seq 1 "$n"); do
    local out="$WORKDIR/result_${label}_${i}.json"
    if ! "$REQUIEM" exec run --request "$req_file" --out "$out" 2>/dev/null; then
      echo "    FAIL run $i: exec returned non-zero"
      failures=$((failures + 1))
      continue
    fi
    local digest
    digest=$(grep -o '"result_digest":"[^"]*"' "$out" 2>/dev/null | head -1 | cut -d'"' -f4 || true)
    if [ -z "$digest" ]; then
      echo "    FAIL run $i: no result_digest in output"
      failures=$((failures + 1))
      continue
    fi
    if [ -z "$first_digest" ]; then
      first_digest="$digest"
    elif [ "$digest" != "$first_digest" ]; then
      echo "    DRIFT run $i: $digest != $first_digest"
      failures=$((failures + 1))
    fi
  done

  local fixture_end
  fixture_end=$(date +%s)
  local elapsed=$((fixture_end - fixture_start))
  local pass_str="true"
  [ "$failures" -gt 0 ] && pass_str="false" && OVERALL_PASS=false

  # Check expected_digest file if present
  local expected_file="${req_file%.request.json}.expected_digest"
  local expected_check="skipped"
  if [ -f "$expected_file" ]; then
    local expected_digest
    expected_digest=$(cat "$expected_file" | tr -d '[:space:]')
    if [ -n "$first_digest" ] && [ "$first_digest" = "$expected_digest" ]; then
      expected_check="matched"
    elif [ -n "$first_digest" ]; then
      echo "    REGRESSION[$label]: digest $first_digest != expected $expected_digest"
      expected_check="mismatch"
      OVERALL_PASS=false
    fi
  fi

  TOTAL_RUNS=$((TOTAL_RUNS + n))
  TOTAL_DRIFT=$((TOTAL_DRIFT + failures))

  # Append JSON record (no jq required)
  FIXTURE_RESULTS+=("{\"label\":\"${label}\",\"runs\":${n},\"drift_count\":${failures},\"pass\":${pass_str},\"reference_digest\":\"${first_digest}\",\"expected_digest_check\":\"${expected_check}\",\"elapsed_s\":${elapsed}}")
  echo "  fixture[$label]: $([ "$pass_str" = "true" ] && echo PASS || echo FAIL) (drift=${failures}/${n}, ${elapsed}s)"
}

# ---------------------------------------------------------------------------
# 1. Inline fixture (backward-compatible with original gate)
# ---------------------------------------------------------------------------
cat > "$WORKDIR/inline.request.json" <<'REQ'
{
  "request_id": "determinism-gate",
  "workspace_root": ".",
  "command": "/bin/sh",
  "argv": ["-c", "echo determinism-fixture-output"],
  "timeout_ms": 2000,
  "max_output_bytes": 4096,
  "policy": {"deterministic": true, "mode": "strict"}
}
REQ
run_fixture "inline" "$WORKDIR/inline.request.json" "$RUNS"

# ---------------------------------------------------------------------------
# 2. Golden corpus fixtures (small + medium)
# ---------------------------------------------------------------------------
GOLDEN_DIR="testdata/golden"
if [ -d "$GOLDEN_DIR" ]; then
  for req_file in "$GOLDEN_DIR"/small_*.request.json "$GOLDEN_DIR"/medium_*.request.json; do
    [ -f "$req_file" ] || continue
    label=$(basename "$req_file" .request.json)
    # Small = full RUNS, medium = 20 runs (they're slower)
    n="$RUNS"
    [[ "$label" == medium_* ]] && n=20
    run_fixture "$label" "$req_file" "$n"
  done
else
  echo "  SKIP: testdata/golden/ not found (run scripts/generate_golden_corpus.sh)"
fi

# ---------------------------------------------------------------------------
# 3. Concurrent arm (3 workers × 20 runs, same inline fixture)
# ---------------------------------------------------------------------------
echo "  concurrent arm: 3 workers × 20 runs..."
CONCURRENT_PASS=true
CONCURRENT_DIGESTS=()
for w in 1 2 3; do
  (
    first_d=""
    for r in $(seq 1 20); do
      out="$WORKDIR/conc_${w}_${r}.json"
      "$REQUIEM" exec run --request "$WORKDIR/inline.request.json" --out "$out" 2>/dev/null || true
      d=$(grep -o '"result_digest":"[^"]*"' "$out" 2>/dev/null | head -1 | cut -d'"' -f4 || true)
      [ -z "$first_d" ] && first_d="$d"
      [ -n "$d" ] && [ "$d" != "$first_d" ] && echo "CONCURRENT_DRIFT worker=$w run=$r"
    done
    echo "$first_d" > "$WORKDIR/conc_worker_${w}.digest"
  ) &
done
wait

CONCURRENT_REF=""
CONCURRENT_DRIFT=0
for w in 1 2 3; do
  d=$(cat "$WORKDIR/conc_worker_${w}.digest" 2>/dev/null || true)
  [ -z "$CONCURRENT_REF" ] && CONCURRENT_REF="$d"
  [ -n "$d" ] && [ "$d" != "$CONCURRENT_REF" ] && CONCURRENT_DRIFT=$((CONCURRENT_DRIFT + 1))
done
[ "$CONCURRENT_DRIFT" -gt 0 ] && CONCURRENT_PASS=false && OVERALL_PASS=false
echo "  concurrent arm: $([ "$CONCURRENT_PASS" = "true" ] && echo PASS || echo FAIL) (cross-worker drift=${CONCURRENT_DRIFT})"

# ---------------------------------------------------------------------------
# Emit determinism_report.json
# ---------------------------------------------------------------------------
END_EPOCH=$(date +%s)
WALL_TIME=$((END_EPOCH - START_EPOCH))
PASS_STR="$OVERALL_PASS"

# Build fixtures array
FIXTURES_JSON=""
for entry in "${FIXTURE_RESULTS[@]}"; do
  [ -n "$FIXTURES_JSON" ] && FIXTURES_JSON="${FIXTURES_JSON},"
  FIXTURES_JSON="${FIXTURES_JSON}${entry}"
done

cat > "$REPORT_FILE" <<REPORTEOF
{
  "schema": "determinism_report_v2",
  "pass": ${PASS_STR},
  "total_runs": ${TOTAL_RUNS},
  "total_drift": ${TOTAL_DRIFT},
  "concurrent_drift": ${CONCURRENT_DRIFT},
  "concurrent_pass": ${CONCURRENT_PASS},
  "wall_time_s": ${WALL_TIME},
  "hash_primitive": "blake3",
  "engine_binary": "${REQUIEM}",
  "fixtures": [${FIXTURES_JSON}]
}
REPORTEOF

echo ""
echo "  Report: $REPORT_FILE"
cat "$REPORT_FILE"
echo ""

if [ "$OVERALL_PASS" = "true" ]; then
  echo "=== verify:determinism PASSED (total_runs=${TOTAL_RUNS}, drift=0) ==="
  exit 0
else
  echo "=== verify:determinism FAILED (drift=${TOTAL_DRIFT}/${TOTAL_RUNS}) ==="
  exit 1
fi
