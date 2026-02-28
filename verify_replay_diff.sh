#!/bin/bash
set -e

# verify_replay_diff.sh
# Verifies that 'requiem replay --diff' correctly identifies divergence points
# between two forked execution traces.

# 1. Build the CLI
cmake --build . --target requiem_cli > /dev/null

CAS_DIR=".requiem/cas/test_diff_$$"
rm -rf "$CAS_DIR"
mkdir -p "$CAS_DIR"

echo "[verify_replay_diff] Setting up test CAS in $CAS_DIR..."

# 2. Create initial state
echo '{"mem":0}' > state.json
STATE_DIGEST=$(./requiem cas put --in state.json --cas "$CAS_DIR")

# 3. Create start event (Sequence 0)
# We manually construct the JSON event to bootstrap the chain.
echo "{\"type\":\"start\",\"state_after\":\"$STATE_DIGEST\",\"seq\":0,\"t_ns\":1000}" > event0.json
EVENT0_DIGEST=$(./requiem cas put --in event0.json --cas "$CAS_DIR")

# 4. Create execution root pointing to start event
echo "{\"type\":\"execution_root\",\"head_event\":\"$EVENT0_DIGEST\"}" > root.json
ROOT_DIGEST=$(./requiem cas put --in root.json --cas "$CAS_DIR")

echo "[verify_replay_diff] Root digest: $ROOT_DIGEST"

# 5. Fork A (Sequence 1)
FORK_A_JSON=$(./requiem replay fork --root "$ROOT_DIGEST" --payload "payload_A" --cas "$CAS_DIR")
# Extract forked_root using python for reliability
ROOT_A=$(echo "$FORK_A_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['forked_root'])")

# 6. Fork B (Sequence 1) - Different payload implies divergence at Seq 1
FORK_B_JSON=$(./requiem replay fork --root "$ROOT_DIGEST" --payload "payload_B" --cas "$CAS_DIR")
ROOT_B=$(echo "$FORK_B_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['forked_root'])")

echo "[verify_replay_diff] Fork A: $ROOT_A"
echo "[verify_replay_diff] Fork B: $ROOT_B"

# 7. Run Diff
DIFF_JSON=$(./requiem replay diff --root1 "$ROOT_A" --root2 "$ROOT_B" --cas "$CAS_DIR")
echo "[verify_replay_diff] Diff Output: $DIFF_JSON"

# 8. Verify Divergence
# We expect divergence at sequence_id 1 (since 0 is shared).
if echo "$DIFF_JSON" | grep -q '"first_divergence_seq":1'; then
    echo "[verify_replay_diff] PASS: Divergence correctly identified at seq 1."
    rm state.json event0.json root.json
    rm -rf "$CAS_DIR"
    exit 0
else
    echo "[verify_replay_diff] FAIL: Expected divergence at seq 1 not found."
    exit 1
fi
