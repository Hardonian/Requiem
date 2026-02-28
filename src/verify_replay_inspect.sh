#!/bin/bash
set -e

# verify_replay_inspect.sh
# Verifies that 'requiem replay --inspect' can correctly load and inspect
# the state of a past execution from the CAS.

# 1. Build the CLI
cmake --build . --target requiem_cli > /dev/null

echo "[verify_replay_inspect] Running demo execution..."

# 2. Create a simple request
echo '{"command": "echo", "argv": ["requiem_inspect_test"], "request_id": "inspect-1"}' > inspect_req.json

# 3. Run execution and capture result
./requiem exec run --request inspect_req.json --out inspect_res.json

# 4. Store result in CAS to make it replayable
DIGEST=$(./requiem cas put --in inspect_res.json)
echo "[verify_replay_inspect] Execution digest: $DIGEST"

# 5. Inspect Sequence 0 (Start)
OUTPUT=$(./requiem replay --inspect --root "$DIGEST" --seq 0)
echo "[verify_replay_inspect] Inspect output: $OUTPUT"

# 6. Verify output contains expected sequence ID
if echo "$OUTPUT" | grep -q '"sequence_id":0'; then
    echo "[verify_replay_inspect] PASS: Successfully inspected sequence 0."
    rm inspect_req.json inspect_res.json
    exit 0
else
    echo "[verify_replay_inspect] FAIL: Output did not contain sequence_id:0"
    exit 1
fi
