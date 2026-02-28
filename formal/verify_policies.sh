#!/bin/bash
set -e

# verify_policies.sh — Validate a JSON policy definition against the TLA+ spec.
# Usage: ./scripts/verify_policies.sh <path_to_policy.json>

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <policy_json_file>"
    exit 1
fi

POLICY_FILE="$1"

if [ ! -f "$POLICY_FILE" ]; then
    echo "Error: Policy file '$POLICY_FILE' not found."
    exit 1
fi

echo "Validating policy definitions in $POLICY_FILE..."
python3 formal/model_checker.py --spec PolicyCompiler --policy-file "$POLICY_FILE"
