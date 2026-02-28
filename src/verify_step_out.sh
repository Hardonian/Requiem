#!/bin/bash
set -e

# verify_step_out.sh
# Verifies that 'requiem replay --step-out' correctly jumps from a tool_call
# to its corresponding tool_result, skipping intermediate events.

# 1. Build the CLI
cmake --build . --target requiem_cli > /dev/null

CAS_DIR=".requiem/cas/test_step_out_$$"
rm -rf "$CAS_DIR"
mkdir -p "$CAS_DIR"

echo "[verify_step_out] Setting up test CAS in $CAS_DIR..."

# Helper to put content
put_cas() {
    echo "$1" > temp.json
    ./requiem cas put --in temp.json --cas "$CAS_DIR"
    rm temp.json
}

# 2. Construct Event Chain
# Seq 0: Start
S0=$(put_cas '{"mem":0}')
E0=$(put_cas "{\"type\":\"start\",\"state_after\":\"$S0\",\"sequence_id\":0}")

# Seq 1: Tool Call (Scope Start)
S1=$(put_cas '{"mem":1}')
E1=$(put_cas "{\"type\":\"tool_call\",\"state_after\":\"$S1\",\"sequence_id\":1,\"parent_event\":\"$E0\"}")

# Seq 2: Intermediate Log (Inside Scope)
S2=$(put_cas '{"mem":2}')
E2=$(put_cas "{\"type\":\"log\",\"state_after\":\"$S2\",\"sequence_id\":2,\"parent_event\":\"$E1\"}")

# Seq 3: Tool Result (Scope End)
S3=$(put_cas '{"mem":3}')
E3=$(put_cas "{\"type\":\"tool_result\",\"state_after\":\"$S3\",\"sequence_id\":3,\"parent_event\":\"$E2\"}")

# Root
ROOT=$(put_cas "{\"type\":\"execution_root\",\"head_event\":\"$E3\"}")

echo "[verify_step_out] Root digest: $ROOT"

# 3. Run Step Out from Seq 1 (Tool Call)
# We expect to land on Seq 3 (Tool Result), skipping Seq 2.
OUTPUT=$(./requiem replay --step-out --root "$ROOT" --seq 1 --cas "$CAS_DIR")
echo "[verify_step_out] Output: $OUTPUT"

# 4. Verify
if echo "$OUTPUT" | grep -q '"new_sequence_id":3'; then
    echo "[verify_step_out] PASS: Stepped out from 1 to 3."
    rm -rf "$CAS_DIR"
    exit 0
else
    echo "[verify_step_out] FAIL: Did not land on sequence 3."
    rm -rf "$CAS_DIR"
    exit 1
fi
