# Differentiation Proof: Semantic State Machine

## Overview

This document provides a runnable demonstration that proves the Semantic State Machine (SSM) primitive is materially different from what GitHub Actions + OPA + Postgres can provide without re-implementing core semantics.

## Prerequisites

- Node.js >= 20.11.0
- Requiem CLI built and available

## The Proof

### Step 1: Generate Semantic State IDs (Content-Derived Fingerprints)

GitHub Actions uses time-based workflow run IDs. SSM uses content-derived BLAKE3 hashes.

```bash
# Create two descriptors with a controlled change (model change)
cat > /tmp/descriptor_a.json << 'EOF'
{
  "modelId": "gpt-4",
  "modelVersion": "2024-01",
  "promptTemplateId": "customer-support-v1",
  "promptTemplateVersion": "1.0.0",
  "policySnapshotId": "policy-prod-v1-abc123def4567890123456789012345678901234",
  "contextSnapshotId": "context-kb-v1-fedcba0987654321098765432109876543210fedcb",
  "runtimeId": "node-20-lts"
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
  "runtimeId": "node-20-lts"
}
EOF

# Create genesis states from both descriptors
reach state genesis --descriptor /tmp/descriptor_a.json --actor "differentiation-proof" --label demo=true
reach state genesis --descriptor /tmp/descriptor_b.json --actor "differentiation-proof" --label demo=true

# List states to see the generated IDs
reach state list --label demo=true --minimal
```

**What This Proves:**
- State IDs are deterministic (same descriptor → same ID)
- State IDs are content-derived (different descriptor → different ID)
- IDs are stable across time and systems

**GitHub Actions Equivalent:** None. GHA run IDs are time-based and sequential, not content-derived.

### Step 2: Classify Drift Between States

```bash
# Get the state IDs
STATE_A=$(reach state list --label demo=true --minimal | grep gpt-4 | awk '{print $1}')
STATE_B=$(reach state list --label demo=true --minimal | grep claude-3 | awk '{print $1}')

# Show the semantic diff
reach state diff $STATE_A $STATE_B
```

**Expected Output:**
```
┌────────────────────────────────────────────────────────────┐
│ SEMANTIC DIFF                                              │
├────────────────────────────────────────────────────────────┤
│  State A: abc123...                                        │
│  State B: def456...                                        │
├────────────────────────────────────────────────────────────┤
│  DRIFT CATEGORIES                                          │
│    • model_drift                                           │
├────────────────────────────────────────────────────────────┤
│  CHANGE VECTORS                                            │
│                                                            │
│  Path: modelId                                             │
│  From: gpt-4@2024-01                                       │
│  To:   claude-3-opus@2024-02                               │
│  Significance: critical                                    │
└────────────────────────────────────────────────────────────┘
```

**What This Proves:**
- Automated drift classification (not just text diff)
- Semantic significance levels (critical/major/minor/cosmetic)
- Structured change vectors

**GitHub Actions + OPA Equivalent:** Would require manual diffing or custom OPA policies. No built-in semantic drift taxonomy.

### Step 3: View Integrity Scores

```bash
reach state show $STATE_A --minimal
reach state show $STATE_B --minimal
```

**What This Proves:**
- Computed integrity scores from verifiable signals
- Score breakdown (parity, policy, context, eval, replay, signing)
- Deterministic computation

**GitHub Actions + OPA Equivalent:** No equivalent. Would need custom metrics pipeline.

### Step 4: Create a Transition (Lineage)

```bash
# Create a transition documenting the model migration
reach state transition \
  --from $STATE_A \
  --to $STATE_B \
  --reason "Migrate from GPT-4 to Claude 3 for improved reasoning"

# View the lineage as a graph
reach state graph
```

**Expected Output (DOT format):**
```dot
digraph SemanticStateMachine {
  rankdir=TB;
  node [shape=box, fontname="monospace"];
  "abc123..." [label="abc123...\ngpt-4\nscore:83"];
  "def456..." [label="def456...\nclaude-3-opus\nscore:83"];
  "abc123..." -> "def456..." [label="model_drift"];
}
```

**What This Proves:**
- Semantic lineage (intent-based, not just structural)
- Transition history with reasons
- Exportable graph format

**GitHub Actions + OPA Equivalent:** Job dependencies are structural, not semantic. No built-in lineage with drift classification.

### Step 5: Run Model Migration Simulation

```bash
# Simulate upgrading all gpt-4 states to claude-3
reach state simulate upgrade \
  --from gpt-4 \
  --to claude-3-opus \
  --json | jq '.summary'
```

**Expected Output:**
```json
{
  "needsReEval": 1,
  "policyRisk": 0,
  "replayBreak": 0,
  "compatible": 0
}
```

**What This Proves:**
- Offline impact prediction
- Risk categorization
- Selective re-evaluation planning

**GitHub Actions + OPA Equivalent:** Would require full re-test of all workflows. No simulation capability.

### Step 6: Export Semantic Ledger

```bash
# Export the complete ledger
reach state export --output /tmp/semantic-ledger.json

# View the bundle structure
cat /tmp/semantic-ledger.json | jq '{
  version: .version,
  stateCount: (.states | length),
  transitionCount: (.transitions | length)
}'
```

**Expected Output:**
```json
{
  "version": "1.0.0",
  "stateCount": 2,
  "transitionCount": 1
}
```

**What This Proves:**
- Portable semantic ledger
- Versioned bundle format
- Complete lineage preservation

**GitHub Actions + OPA Equivalent:** GHA workflow logs are not portable in this structured way.

### Step 7: View in Cloud UI

Open the ReadyLayer dashboard and navigate to:

```
http://localhost:3000/app/semantic-ledger
```

**What You'll See:**
- Summary cards showing state counts and average integrity
- State cards with integrity badges and drift tags
- Detail panel with descriptor and transitions
- Filter controls for model and integrity score

**What This Proves:**
- Purpose-built UI for semantic state exploration
- Real-time visualization of drift taxonomy
- Integrity score visualization

**GitHub Actions + OPA Equivalent:** Would require building a custom dashboard. No built-in semantic visualization.

## Summary: The Differentiation

| Capability | GitHub Actions + OPA | Requiem SSM |
|------------|---------------------|-------------|
| **State Identity** | Time-based run ID | Content-derived fingerprint |
| **State Lineage** | Job dependencies (structural) | Semantic transitions (intent) |
| **Drift Detection** | Manual diff | Automated taxonomy |
| **Drift Classification** | None | 7 categories with significance |
| **Integrity Score** | None | 0-100 from verifiable signals |
| **Model Migration** | Full re-test | Simulation + selective re-eval |
| **Export Format** | Logs (unstructured) | Semantic ledger bundle |
| **Purpose-Built UI** | Generic dashboard | Semantic ledger explorer |

## Why This Matters

GitHub Actions + OPA is designed for **CI/CD pipelines** — building, testing, and deploying code.

The Semantic State Machine is designed for **AI execution governance**:
- Tracking semantic configuration changes
- Verifying lineage and integrity
- Simulating model migrations
- Providing verifiable state identities

You *could* build something like SSM on top of GHA + OPA, but you would need to:
1. Implement content-derived fingerprinting
2. Build a drift taxonomy classifier
3. Create an integrity score computation
4. Design a semantic ledger format
5. Build a purpose-built UI

By the time you've done that, you've reimplemented the core of what makes SSM unique.

## Running the Demo

```bash
# Quick one-liner to run the complete demo
npm run demo:semantic-state-machine

# Or run steps manually
reach state genesis --descriptor examples/semantic-state/descriptor_a.json
reach state genesis --descriptor examples/semantic-state/descriptor_b.json
reach state list
reach state graph
```

## Cleanup

```bash
# Remove demo states (optional)
rm -rf .reach/state
```
