#!/bin/bash
#
# Demo script for the Semantic State Machine differentiation proof.
# Run: bash scripts/demo-semantic-state-machine.sh

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  SEMANTIC STATE MACHINE - DIFFERENTIATION PROOF DEMO           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if reach CLI is available
if ! command -v reach &> /dev/null && ! command -v requiem &> /dev/null; then
    echo "Error: reach/requiem CLI not found. Please build the CLI first."
    echo "  pnpm --filter @requiem/cli build"
    exit 1
fi

REACH_CMD="${REACH_CMD:-reach}"
echo "Using CLI: $REACH_CMD"
echo ""

# Step 1: Create descriptors
echo "📄 Step 1: Creating descriptor files..."
cat > /tmp/descriptor_a.json << 'EOF'
{
  "modelId": "gpt-4",
  "modelVersion": "2024-01",
  "promptTemplateId": "customer-support-v1",
  "promptTemplateVersion": "1.0.0",
  "policySnapshotId": "policy-prod-v1-abc123def4567890123456789012345678901234",
  "contextSnapshotId": "context-kb-v1-fedcba0987654321098765432109876543210fedcb",
  "runtimeId": "node-20-lts",
  "evalSnapshotId": "eval-golden-set-v1-1234567890abcdef1234567890abcdef12345678"
}
EOF

cat > /tmp/descriptor_b.json << 'EOF'
{
  "modelId": "claude-3-opus",
  "modelVersion": "2024-02",
  "promptTemplateId": "customer-support-v1",
  "promptTemplateVersion": "1.0.0",
  "policySnapshotId": "policy-prod-v1-abc123def4567890123456789012345678901234",
  "contextSnapshotId": "context-kb-v1-fedcba0987654321098765432109876543210fedcb",
  "runtimeId": "node-20-lts",
  "evalSnapshotId": "eval-golden-set-v1-1234567890abcdef1234567890abcdef12345678"
}
EOF
echo "   Created: /tmp/descriptor_a.json (gpt-4)"
echo "   Created: /tmp/descriptor_b.json (claude-3-opus)"
echo ""

# Step 2: Create genesis states
echo "🎯 Step 2: Creating semantic states..."
$REACH_CMD state genesis --descriptor /tmp/descriptor_a.json --actor "demo-script" --label demo=true 2>/dev/null || true
$REACH_CMD state genesis --descriptor /tmp/descriptor_b.json --actor "demo-script" --label demo=true 2>/dev/null || true
echo ""

# Step 3: List states
echo "📋 Step 3: Listing semantic states..."
$REACH_CMD state list --label demo=true --minimal 2>/dev/null || echo "   (No states found - is the CLI built?)"
echo ""

# Step 4: Show drift classification
echo "🔍 Step 4: Demonstrating drift classification..."
echo "   The SSM automatically classifies semantic drift between states:"
echo ""

# Get state IDs and show diff if states exist
STATES=$($REACH_CMD state list --label demo=true --minimal 2>/dev/null || echo "")
if [ -n "$STATES" ]; then
    STATE_A=$(echo "$STATES" | grep gpt-4 | awk '{print $1}' | head -1)
    STATE_B=$(echo "$STATES" | grep claude-3 | awk '{print $1}' | head -1)
    
    if [ -n "$STATE_A" ] && [ -n "$STATE_B" ]; then
        $REACH_CMD state diff $STATE_A $STATE_B 2>/dev/null || echo "   (Diff requires states to exist)"
    fi
else
    echo "   States not found. This is expected if the CLI is not built."
    echo "   The drift taxonomy would show:"
    echo "     • model_drift (critical)"
    echo "     • change vector: modelId changed"
fi
echo ""

# Step 5: Show graph
echo "📊 Step 5: Generating lineage graph (DOT format)..."
$REACH_CMD state graph 2>/dev/null || echo "   (Graph generation requires states)"
echo ""

# Step 6: Simulate migration
echo "🧮 Step 6: Simulating model migration..."
$REACH_CMD state simulate upgrade --from gpt-4 --to claude-3-opus 2>/dev/null || echo "   (Simulation requires states)"
echo ""

# Step 7: Export ledger
echo "💾 Step 7: Exporting semantic ledger..."
$REACH_CMD state export --output /tmp/demo-ledger.json 2>/dev/null || echo "   (Export requires states)"
if [ -f /tmp/demo-ledger.json ]; then
    echo "   Exported to: /tmp/demo-ledger.json"
    if command -v jq &> /dev/null; then
        jq '{version, states: (.states | length), transitions: (.transitions | length)}' /tmp/demo-ledger.json
    fi
fi
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  DEMO COMPLETE                                                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Key Differentiators from GitHub Actions + OPA:"
echo "  ✓ Content-derived state IDs (not time-based)"
echo "  ✓ Semantic drift taxonomy (not just text diff)"
echo "  ✓ Integrity scores from verifiable signals"
echo "  ✓ Model migration simulation (not full re-test)"
echo "  ✓ Exportable semantic ledger (not just logs)"
echo ""
echo "View the Cloud UI at: http://localhost:3000/app/semantic-ledger"
echo ""
echo "Documentation:"
echo "  • docs/reference/semantic-state-machine.md"
echo "  • docs/reference/cli-semantic-state.md"
echo "  • docs/audits/DIFFERENTIATION_PROOF.md"
echo ""
