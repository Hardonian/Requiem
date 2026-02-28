#!/bin/bash
set -e

# verify_step_over.sh
# Verifies that 'requiem replay --step-over' skips tool calls.

cmake --build . --target requiem_cli > /dev/null

CAS_DIR=".requiem/cas/test_step_over_$$"
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
E1=$(put_cas "{\"type\":\"tool_call\",\"state_after\":\"$S1\",\"sequence_id\":1,\"parent_event\":\"$E0\"}")
S2=$(put_cas '{"mem":2}')
E2=$(put_cas "{\"type\":\"log\",\"state_after\":\"$S2\",\"sequence_id\":2,\"parent_event\":\"$E1\"}")
S3=$(put_cas '{"mem":3}')
E3=$(put_cas "{\"type\":\"tool_result\",\"state_after\":\"$S3\",\"sequence_id\":3,\"parent_event\":\"$E2\"}")
ROOT=$(put_cas "{\"type\":\"execution_root\",\"head_event\":\"$E3\"}")

echo "[verify_step_over] Root: $ROOT"

# StepOver from 1 (tool_call) should go to 3 (tool_result)
OUTPUT=$(./requiem replay --step-over --root "$ROOT" --seq 1 --cas "$CAS_DIR")
echo "[verify_step_over] Output: $OUTPUT"

if echo "$OUTPUT" | grep -q '"new_sequence_id":3'; then
    echo "[verify_step_over] PASS"
    rm -rf "$CAS_DIR"
    exit 0
else
    echo "[verify_step_over] FAIL"
    exit 1
fi
