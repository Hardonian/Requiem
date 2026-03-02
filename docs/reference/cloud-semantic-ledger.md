# Cloud UI: Semantic Ledger

## Overview

The Semantic Ledger is the Cloud UI visualization of the Semantic State Machine primitive. It provides a calm, engineering-focused interface for exploring semantic states, transitions, drift taxonomy, and integrity scores.

## Page Structure

### URL

`/app/semantic-ledger`

### Navigation

Located under **Execution > Semantic Ledger** in the sidebar navigation.

## UI Components

### Summary Cards

Four metric cards at the top of the page:

| Card | Value | Description |
|------|-------|-------------|
| Total States | Count | Number of semantic states in ledger |
| Avg Integrity | 0-100 | Average integrity score across states |
| High Integrity | Count | States with score ≥ 80 |
| Transitions | Count | Recorded state transitions |

### State List

A filterable grid of state cards showing:

- **State ID** (truncated): First 16 characters of the semantic state ID
- **Integrity Badge**: Color-coded score (green ≥80, amber ≥60, red <60)
- **Model**: Model ID from descriptor
- **Prompt Template**: Template identifier
- **Created**: Date of state creation
- **Labels**: User-defined key-value pairs

### Filters

- **Model filter**: Text input for filtering by model ID
- **Min Score filter**: Dropdown for minimum integrity score (80+, 60+, 40+)

### State Detail Panel

Clicking a state opens the detail panel with:

#### Integrity Score Visualization

- Circular progress indicator showing score
- Horizontal bar with gradient (red → amber → green)
- Description of verifiable signals

#### Descriptor Section

Structured display of:
- Model ID and version
- Prompt template ID and version
- Policy snapshot ID (truncated)
- Context snapshot ID (truncated)
- Runtime ID
- Eval snapshot ID (if present)

#### Transitions Section

List of transitions to/from the state showing:
- Timestamp
- Integrity delta (with +/- indicator)
- Reason for transition
- Drift category tags

### Empty State

When no states exist:

- Icon illustration
- "No Semantic States" heading
- Description text
- CLI command example for creating first state

### Error State

If data loading fails:

- Red alert icon
- Error message
- Retry button

### Loading State

Skeleton placeholders while loading:
- Pulsing rectangles for summary cards
- Pulsing blocks for state list

## Drift Taxonomy Visualization

Drift categories are displayed as color-coded tags:

| Category | Color | Significance |
|----------|-------|--------------|
| model_drift | Purple | Critical |
| prompt_drift | Blue | Critical/Major |
| policy_drift | Orange | Major |
| context_drift | Slate | Minor |
| eval_drift | Pink | Minor |
| runtime_drift | Gray | Minor |
| unknown_drift | Gray (muted) | Cosmetic |

## UX Principles

### Calm Language

- No marketing fluff
- Technical precision
- Engineering-focused terminology

### Loading/Empty/Error States

Every UI state is handled:
- **Loading**: Skeleton placeholders
- **Empty**: Helpful CLI command example
- **Error**: Clear message with retry action

### Theme Support

The UI uses:
- Slate color palette (neutral grays)
- White cards on light background
- Purple accents for SSM branding
- Color-coded integrity badges
- No hardcoded dark mode; inherits from parent layout

## Integration with CLI

The UI complements the CLI commands:

| UI Action | CLI Equivalent |
|-----------|----------------|
| View state details | `reach state show <id>` |
| Filter by model | `reach state list --model <id>` |
| Filter by score | `reach state list --min-score <n>` |
| View transitions | `reach state diff <from> <to>` |

## Future Enhancements

Planned but not yet implemented:

1. **Lineage Graph Visualization**: Interactive DAG of state transitions
2. **Migration Simulator Panel**: UI for `reach state simulate upgrade`
3. **Real-time Updates**: WebSocket connection for live state changes
4. **Export Button**: Direct download of ledger bundle

## See Also

- `semantic-state-machine.md` — Core primitive documentation
- `cli-semantic-state.md` — CLI command reference
