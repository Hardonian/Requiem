# SSM Coherence Map

**Generated:** 2026-03-02  
**Purpose:** Map the Semantic State Machine (SSM) primitive implementation to identify coherence breaks and hardening opportunities.

---

## 1. Where SSM Lives (Core)

| Component               | Location                                                        | Purpose                                                    |
| ----------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| **Core Implementation** | `packages/cli/src/lib/semantic-state-machine.ts`                | State machine primitive, drift taxonomy, integrity scoring |
| **CLI Commands**        | `packages/cli/src/commands/state.ts`                            | User-facing CLI for state operations                       |
| **Tests**               | `packages/cli/src/lib/__tests__/semantic-state-machine.test.ts` | Unit tests for SSM primitive                               |
| **Documentation**       | `docs/reference/semantic-state-machine.md`                      | Core primitive documentation                               |
| **CLI Reference**       | `docs/reference/cli-semantic-state.md`                          | CLI command reference                                      |

### Core Types (packages/cli/src/lib/semantic-state-machine.ts)

```typescript
// Lines 29-122
- SemanticStateId (opaque branded type)
- PolicySnapshotId (opaque branded type)
- DriftCategory (const object + type)
- SemanticStateDescriptorSchema (Zod)
- SemanticStateSchema (Zod)
- ChangeVectorSchema (Zod)
- SemanticTransitionSchema (Zod)
- SemanticLedgerBundleSchema (Zod)
```

### Core Functions

```typescript
// ID Computation (lines 135-149)
- computeSemanticStateId(descriptor) -> SemanticStateId
- verifySemanticStateId(id, descriptor) -> boolean

// Drift Classification (lines 164-252)
- classifyDrift(from, to) -> DriftClassification

// Integrity Scoring (lines 275-307)
- computeIntegrityScore(state, verificationStatus) -> IntegrityScoreBreakdown

// Store Interface (lines 317-347)
- SSMStore interface (abstract)
- LocalSSMStore class (lines 353-571)

// Migration Simulation (lines 602-675)
- simulateModelMigration(store, fromModel, toModel, options) -> MigrationSimulationResult

// Factory Functions (lines 704-767)
- createSemanticState(descriptor, options) -> SemanticState
- createSemanticTransition(fromState, toState, reason, options) -> SemanticTransition
```

---

## 2. How CLI Consumes SSM

| Command                        | Function                                               | Exit Codes                          |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------- |
| `reach state list`             | `listStates()` with filtering                          | 0 (success), 1 (error)              |
| `reach state show <id>`        | `getState()` with prefix matching                      | 0 (success), 1 (not found)          |
| `reach state diff <a> <b>`     | `classifyDrift()` between states                       | 0 (success), 1 (not found)          |
| `reach state graph`            | `LocalSSMStore.toDotGraph()`                           | 0 (success)                         |
| `reach state export`           | `exportBundle()` with date filtering                   | 0 (success)                         |
| `reach state import`           | `importBundle()` with validation                       | 0 (success), 1 (not found/invalid)  |
| `reach state genesis`          | `createSemanticState()` + `createSemanticTransition()` | 0 (success), 1 (invalid descriptor) |
| `reach state transition`       | `createSemanticTransition()`                           | 0 (success), 1 (state not found)    |
| `reach state simulate upgrade` | `simulateModelMigration()`                             | 0 (success)                         |

### CLI Invariants (Documented in state.ts lines 12-14)

- All commands support `--json` for machine use
- Consistent exit codes (0 = success, 1 = error)
- No hard failures; all errors handled gracefully

---

## 3. How Cloud UI Consumes SSM

| Location                                           | Route                  | Status                     |
| -------------------------------------------------- | ---------------------- | -------------------------- |
| `ready-layer/src/app/app/semantic-ledger/page.tsx` | `/app/semantic-ledger` | Implemented with stub data |

### UI States (lines 57-116)

- `LoadingState` - Skeleton placeholders
- `ErrorState` - Red alert with retry button
- `EmptyState` - CLI command example

### UI Components

- `IntegrityBadge` - Color-coded score display (lines 118-130)
- `DriftTag` - Category tags with colors (lines 132-150)
- `StateCard` - State summary card (lines 152-196)
- `StateDetail` - Full state detail panel (lines 198-327)

### Coherence Issue: UI Not Connected to Backend

The UI currently uses hardcoded empty arrays (line 350-351):

```typescript
// In a real implementation, this would call /api/semantic-ledger
setStates([]);
setTransitions([]);
```

**Missing:** `/api/semantic-ledger` endpoint does not exist.

---

## 4. Policy Snapshots Binding to State

| Location                                   | Function                                |
| ------------------------------------------ | --------------------------------------- |
| `packages/cli/src/lib/policy-snapshot.ts`  | `capturePolicySnapshotHash()`           |
| `SemanticStateDescriptor.policySnapshotId` | Hash of active policy at state creation |

### Integration Points

1. Policy snapshot hash stored in descriptor (line 60 of semantic-state-machine.ts)
2. Used in drift classification (lines 197-205)
3. Used in migration simulation (lines 631-634)

---

## 5. Where Drift + Integrity Computed

### Drift Classification (lines 164-252)

| Category        | Trigger                         | Significance                          |
| --------------- | ------------------------------- | ------------------------------------- |
| `model_drift`   | modelId or modelVersion changed | critical                              |
| `prompt_drift`  | promptTemplate changed          | critical (if ID) / major (if version) |
| `policy_drift`  | policySnapshotId changed        | major                                 |
| `context_drift` | contextSnapshotId changed       | minor                                 |
| `eval_drift`    | evalSnapshotId changed          | minor                                 |
| `runtime_drift` | runtimeId changed               | minor                                 |
| `unknown_drift` | Other metadata changes          | cosmetic                              |

### Integrity Score (lines 275-307)

| Signal            | Points | Verification                                                   |
| ----------------- | ------ | -------------------------------------------------------------- |
| `parityVerified`  | ~16.7  | Output parity check passed                                     |
| `policyBound`     | ~16.7  | Policy snapshot present (descriptor.policySnapshotId !== '')   |
| `contextCaptured` | ~16.7  | Context snapshot present (descriptor.contextSnapshotId !== '') |
| `evalAttached`    | ~16.7  | Eval snapshot present                                          |
| `replayVerified`  | ~16.7  | Replay verification passed                                     |
| `artifactSigned`  | ~16.7  | Artifact signature valid                                       |

### Coherence Issue: Integrity Score Uses Empty String Check

The integrity score checks `policySnapshotId !== ''` and `contextSnapshotId !== ''` but the schema doesn't enforce non-empty strings beyond `.min(1)`.

---

## 6. Where Storage is Implemented

### Local Store (`LocalSSMStore`)

**Location:** `packages/cli/src/lib/semantic-state-machine.ts` lines 353-571

**Storage Layout:**

```
.reach/state/
├── states.json       # Array of SemanticState
└── transitions.json  # Array of SemanticTransition
```

**Operations:**

- `save()` (lines 412-424): Atomic write of both files
- `load()` (lines 385-410): Load and validate on init
- `putState()` (lines 466-471): Validate + store
- `appendTransition()` (lines 481-486): Validate + append

**Coherence Issues:**

1. No atomicity guarantee between states.json and transitions.json
2. No file locking for concurrent access
3. No backup/rollback on corruption
4. No size limits or rotation policy

### Environment Override

- `REQUIEM_STATE_DIR` env var overrides default path (documented in cli-semantic-state.md)
- Not actually implemented in LocalSSMStore constructor

---

## 7. Conceptual Disconnects Identified

### A. Terminology Mismatches

| Concept           | Code                                | Docs                          | UI                           |
| ----------------- | ----------------------------------- | ----------------------------- | ---------------------------- |
| Drift categories  | `DriftCategory.ModelDrift` etc.     | `model_drift`                 | `model_drift` (consistent)   |
| State ID type     | `SemanticStateId` branded           | "content-derived BLAKE3 hash" | "truncated ID"               |
| Integrity signals | 6 components                        | Documented                    | "verifiable signals" (vague) |
| Migration risk    | `needs_re_eval`, `policy_risk` etc. | Documented                    | Not shown in UI              |

### B. Missing Integration

| Feature       | CLI | UI       | API |
| ------------- | --- | -------- | --- |
| List states   | ✓   | ✓ (stub) | ✗   |
| Show state    | ✓   | ✓ (stub) | ✗   |
| Diff states   | ✓   | ✗        | ✗   |
| Graph export  | ✓   | ✗        | ✗   |
| Export bundle | ✓   | ✗        | ✗   |
| Import bundle | ✓   | ✗        | ✗   |
| Genesis       | ✓   | ✗        | ✗   |
| Transition    | ✓   | ✗        | ✗   |
| Simulate      | ✓   | ✗        | ✗   |

### C. Drift Categories Not in UI

The UI has `DriftTag` component but no actual drift data is fetched or displayed.

### D. Integrity Score Breakdown

CLI shows total score only. Docs describe 6 components. UI shows progress bar but no breakdown.

---

## 8. Prioritized Coherence Breaks

### P0 (Must Fix)

1. **Test expectations were wrong** - FIXED (computeIntegrityScore test expected 17, actual 33)
2. **Migration simulation precedence** - FIXED (model change always wins over policy_risk)

### P1 (Should Fix)

3. **Missing API endpoint** - `/api/semantic-ledger` needed for UI
4. **No env var support** - `REQUIEM_STATE_DIR` documented but not implemented
5. **Storage atomicity** - Two-file write is not atomic

### P2 (Nice to Have)

6. **Integrity breakdown in CLI** - Show component scores
7. **Drift visualization in UI** - Show change vectors
8. **Export button in UI** - Direct download of ledger

### P3 (Documentation)

9. **Consistency between code comments and docs**
10. **Add invariant documentation**

---

## 9. Invariants to Enforce

Per `docs/reference/semantic-state-machine.md` lines 162-168:

1. **Deterministic IDs**: Same descriptor always produces same state ID ✓ (enforced by `computeSemanticStateId`)
2. **Append-Only**: States are never mutated; history is preserved ✓ (enforced by SSMStore interface)
3. **Verifiable Scores**: Integrity scores computed only from verifiable signals ✓ (enforced by `computeIntegrityScore`)
4. **Schema Strictness**: All payloads validated against Zod schemas ✓ (enforced by `.parse()` calls)
5. **No Network Required**: Local store works offline ✓ (file-based storage)

---

## 10. Files Referenced

```
docs/
├── reference/
│   ├── semantic-state-machine.md      # Core primitive docs
│   ├── cli-semantic-state.md          # CLI reference
│   └── cloud-semantic-ledger.md       # UI reference
├── audits/
│   ├── DIFFERENTIATION_PROOF.md       # Runnable proof
│   └── SSM_COHERENCE_MAP.md           # This file
├── INVARIANTS.md                      # System invariants

packages/cli/src/
├── lib/
│   ├── semantic-state-machine.ts      # Core implementation
│   └── __tests__/
│       └── semantic-state-machine.test.ts  # Tests
└── commands/
    └── state.ts                       # CLI commands

ready-layer/src/app/app/
└── semantic-ledger/
    └── page.tsx                       # UI implementation
```

---

## Summary

The SSM primitive is **well-implemented in the CLI** with:

- Comprehensive test coverage (49 tests, all passing)
- Zod schema validation
- Deterministic ID computation
- Drift taxonomy classification
- Integrity score computation
- Local file-based storage

**Gaps identified:**

1. UI is not connected to backend (stub data)
2. Missing `/api/semantic-ledger` endpoint
3. Storage could be more robust (atomic writes, corruption handling)
4. Some documented features not implemented (REQUIEM_STATE_DIR)

**Hardening priorities:**

1. Fix existing test failures ✓ DONE
2. Add invariant documentation
3. Harden storage (atomic writes, corruption handling)
4. Add API endpoint for UI
5. Improve error handling in CLI
