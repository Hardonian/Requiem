#!/bin/bash
set -e

# verify_step_into.sh
# Verifies that 'requiem replay --step-into' advances execution.

cmake --build . --target requiem_cli > /dev/null

CAS_DIR=".requiem/cas/test_step_into_$$"
rm -rf "$CAS_DIR"
mkdir -p "$CAS_DIR"

put_cas() {
    echo "$1" > temp.json
    ./requiem cas put --in temp.json --cas "$CAS_DIR"
    rm temp.json
}

S0=$(put_cas '{"mem":0}')
E0=$(put_cas "{\"type\":\"start\",\"state_after\":\"$S0\",\"sequence_id\":0}")
S1=$(put_cas '{"mem":1}')
E1=$(put_cas "{\"type\":\"log\",\"state_after\":\"$S1\",\"sequence_id\":1,\"parent_event\":\"$E0\"}")
ROOT=$(put_cas "{\"type\":\"execution_root\",\"head_event\":\"$E1\"}")

echo "[verify_step_into] Root: $ROOT"

# StepInto from 0 should go to 1
OUTPUT=$(./requiem replay --step-into --root "$ROOT" --seq 0 --cas "$CAS_DIR")
echo "[verify_step_into] Output: $OUTPUT"

if echo "$OUTPUT" | grep -q '"new_sequence_id":1'; then
    echo "[verify_step_into] PASS"
    rm -rf "$CAS_DIR"
    exit 0
else
    echo "[verify_step_into] FAIL"
    exit 1
fi
