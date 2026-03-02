# Semantic State Machine (SSM)

## Overview

The Semantic State Machine is a first-class computing primitive for AI execution governance. It treats AI execution as **semantic state transitions** rather than mere workflow runs, enabling verifiable lineage, drift taxonomy, and governance operations that cannot be replicated with GitHub Actions + OPA + Postgres without re-implementing the core semantics.

## Core Concepts

### Semantic State

A `SemanticState` represents a specific configuration of an AI execution context:

```typescript
interface SemanticState {
  id: SemanticStateId; // Content-derived BLAKE3 hash
  descriptor: SemanticStateDescriptor; // Semantic configuration
  createdAt: string; // ISO 8601 timestamp
  actor: string; // Entity that created the state
  labels?: Record<string, string>; // User-defined labels
  integrityScore: number; // 0-100 computed score
  evidenceRefs?: string[]; // Supporting evidence
}
```

### Semantic State Descriptor

The descriptor captures the semantic configuration:

```typescript
interface SemanticStateDescriptor {
  modelId: string; // e.g., "gpt-4", "claude-3-opus"
  modelVersion?: string; // Optional model version
  promptTemplateId: string; // Prompt template identifier
  promptTemplateVersion: string; // Prompt template version
  policySnapshotId: string; // Hash of active policy
  contextSnapshotId: string; // Hash of context/grounding
  runtimeId: string; // Runtime environment
  evalSnapshotId?: string; // Optional evaluation snapshot
  metadata?: Record<string, unknown>; // Additional metadata
}
```

### Semantic Transition

Transitions record how states evolve:

```typescript
interface SemanticTransition {
  fromId?: string; // Source state (undefined for genesis)
  toId: string; // Target state
  timestamp: string; // ISO 8601 timestamp
  reason: string; // Human-readable reason
  driftCategories: DriftCategory[]; // Classification of changes
  changeVectors: ChangeVector[]; // Detailed change vectors
  integrityDelta: number; // Score change
  replayStatus?: "verified" | "failed" | "pending" | "not_applicable";
}
```

## Drift Taxonomy

The SSM classifies semantic drift into deterministic categories:

| Category        | Trigger                     | Significance                                  |
| --------------- | --------------------------- | --------------------------------------------- |
| `model_drift`   | Model ID or version changed | Critical                                      |
| `prompt_drift`  | Prompt template changed     | Critical (if ID changes) / Major (if version) |
| `policy_drift`  | Policy snapshot changed     | Major                                         |
| `context_drift` | Context/grounding changed   | Minor                                         |
| `eval_drift`    | Evaluation set changed      | Minor                                         |
| `runtime_drift` | Runtime environment changed | Minor                                         |
| `unknown_drift` | Other changes detected      | Cosmetic                                      |

## Integrity Score

The integrity score (0-100) is computed from **verifiable signals only**:

| Signal            | Points | Verification                |
| ----------------- | ------ | --------------------------- |
| `parityVerified`  | ~16.7  | Output parity check passed  |
| `policyBound`     | ~16.7  | Policy snapshot present     |
| `contextCaptured` | ~16.7  | Context snapshot present    |
| `evalAttached`    | ~16.7  | Evaluation snapshot present |
| `replayVerified`  | ~16.7  | Replay verification passed  |
| `artifactSigned`  | ~16.7  | Artifact signature valid    |

## Storage

### Local Store

The `LocalSSMStore` persists states and transitions to `.reach/state/`:

```typescript
const store = new LocalSSMStore("./.reach/state");

// Store a state
store.putState(state);

// Query states
const states = store.listStates({
  modelId: "gpt-4",
  minIntegrityScore: 80,
});

// Append transition
store.appendTransition(transition);

// Export bundle
const bundle = store.exportBundle();
```

### Store Interface

```typescript
interface SSMStore {
  getState(id: SemanticStateId): SemanticState | undefined;
  listStates(filter?: StateFilter): SemanticState[];
  putState(state: SemanticState): void;
  getTransitionsTo(stateId: SemanticStateId): SemanticTransition[];
  getTransitionsFrom(stateId: SemanticStateId): SemanticTransition[];
  appendTransition(transition: SemanticTransition): void;
  exportBundle(): SemanticLedgerBundle;
  importBundle(bundle: SemanticLedgerBundle): void;
}
```

## Model Migration Simulation

Simulate the impact of model changes before applying them:

```typescript
const result = simulateModelMigration(
  store,
  "gpt-4", // from model
  "claude-3-opus", // to model
  { policyRef: "policy-v2" },
);

// Result includes:
// - Total states affected
// - Risk categorization for each state
// - Summary counts by category
```

Risk categories:

- `needs_re_eval`: Model change requires re-evaluation
- `policy_risk`: State uses incompatible policy
- `replay_break`: State has replay failure history
- `compatible`: No action needed

## Why This Differs from GitHub Actions + OPA

| Capability           | GHA + OPA                     | Semantic State Machine           |
| -------------------- | ----------------------------- | -------------------------------- |
| **State Identity**   | Workflow run ID (time-based)  | Content-derived fingerprint      |
| **Lineage**          | Job dependencies (structural) | Semantic transitions (intent)    |
| **Drift Detection**  | Manual diff                   | Automated taxonomy               |
| **Integrity Metric** | None                          | Computed from verifiable signals |
| **Model Migration**  | Full re-test                  | Simulation + selective re-eval   |
| **Policy Binding**   | Sidecar check                 | Snapshot hash in descriptor      |

## Invariants

1. **Deterministic IDs**: Same descriptor always produces same state ID
2. **Append-Only**: States are never mutated; history is preserved
3. **Verifiable Scores**: Integrity scores computed only from verifiable signals
4. **Schema Strictness**: All payloads validated against Zod schemas
5. **No Network Required**: Local store works offline

## See Also

- `drift-and-integrity.md` — Detailed drift classification and integrity scoring
- `cli-semantic-state.md` — CLI commands for state operations
- `cloud-semantic-ledger.md` — Cloud UI for semantic ledger visualization
