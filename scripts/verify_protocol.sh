#!/usr/bin/env bash
set -euo pipefail

echo "=== verify:protocol — health/doctor/validate ==="

# Health check must return valid JSON with blake3 primitive
HEALTH=$(./build/requiem health)
echo "  health: $HEALTH"
echo "$HEALTH" | grep -q '"hash_primitive":"blake3"' || { echo "FAIL: primitive not blake3"; exit 1; }
echo "$HEALTH" | grep -q '"hash_backend":"vendored"' || { echo "FAIL: backend not vendored"; exit 1; }
echo "$HEALTH" | grep -q '"hash_available":true' || { echo "FAIL: hash not available"; exit 1; }
echo "$HEALTH" | grep -q '"compat_warning":false' || { echo "FAIL: compat warning present"; exit 1; }
echo "  PASS: health"

# Doctor must report no blockers
DOCTOR=$(./build/requiem doctor)
echo "  doctor: $DOCTOR"
echo "$DOCTOR" | grep -q '"ok":true' || { echo "FAIL: doctor reports blockers"; exit 1; }
echo "$DOCTOR" | grep -q '"engine_version"' || { echo "FAIL: doctor missing engine_version"; exit 1; }
echo "$DOCTOR" | grep -q '"protocol_version"' || { echo "FAIL: doctor missing protocol_version"; exit 1; }
echo "$DOCTOR" | grep -q '"hash_primitive"' || { echo "FAIL: doctor missing hash_primitive"; exit 1; }
echo "$DOCTOR" | grep -q '"sandbox"' || { echo "FAIL: doctor missing sandbox"; exit 1; }
echo "$DOCTOR" | grep -q '"rollback"' || { echo "FAIL: doctor missing rollback"; exit 1; }
echo "  PASS: doctor"

# Validate-replacement must pass
VALIDATE=$(./build/requiem validate-replacement)
echo "  validate: $VALIDATE"
echo "$VALIDATE" | grep -q '"ok":true' || { echo "FAIL: validate-replacement not ok"; exit 1; }
echo "  PASS: validate-replacement"

echo "=== verify:protocol PASSED ==="
