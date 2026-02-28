#!/bin/bash
set -e

# verify_cli_lint.sh
# Verifies that 'requiem lint' correctly identifies policy conflicts.

# 1. Build the CLI
cmake --build . --target requiem_cli > /dev/null

# 2. Define the policy file path
POLICY_FILE="formal/gdpr_basic.json"

if [ ! -f "$POLICY_FILE" ]; then
    echo "Error: $POLICY_FILE not found."
    exit 1
fi

echo "[verify_cli_lint] Linting $POLICY_FILE..."

# 3. Run lint and capture output
OUTPUT=$(./requiem lint "$POLICY_FILE")

# 4. Verify the output contains the expected error
EXPECTED_ERROR="Policy 'Right to be Forgotten' is self-contradictory: implies conflicting constraints 'soft_delete_enabled' and 'hard_delete_on_request'"

if echo "$OUTPUT" | grep -Fq "$EXPECTED_ERROR"; then
    echo "[verify_cli_lint] PASS: Conflict correctly detected."
    echo "  Output snippet: $(echo "$OUTPUT" | grep -o "Policy 'Right to be Forgotten'.*request'")"
    exit 0
else
    echo "[verify_cli_lint] FAIL: Expected conflict not reported."
    echo "  Actual output: $OUTPUT"
    exit 1
fi
