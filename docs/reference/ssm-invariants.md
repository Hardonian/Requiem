# SSM Invariants

**Status:** Infrastructure-grade  
**Version:** 1.0.0  
**Enforcement:** Runtime assertions (dev mode), CI tests, schema validation

---

## Overview

These invariants are **hard constraints** for the Semantic State Machine primitive. No PR may weaken or remove them without an explicit Architecture Decision Record (ADR).

Each invariant has corresponding:
- Runtime assertions (developer mode)
- CI tests that verify invariant preservation
- Schema validation via Zod
- Documentation of violation triggers

---

## SSM-INV-1: StateId is Opaque Fingerprint

> State IDs are opaque BLAKE3 hash strings. No parsing assumptions may be made about their structure beyond being 64-character hex strings.

**Type Constraint:** `SemanticStateId` branded type  
**Format:** `/^[a-f0-9]{64}$/` (64 character hex)  
**Derivation:** `BLAKE3(canonicalJSON(descriptor))`

**Runtime Assertion:**
```typescript
assertValidStateId(id: string): asserts id is SemanticStateId {
  if (!/^[a-f0-9]{64}$/.test(id)) {
    throw new RequiemError({
      code: ErrorCode.SSM_INVALID_STATE_ID,
      message: `Invalid state ID format: expected 64-char hex, got ${id.length} chars`,
      severity: 'error',
    });
  }
}
```

**Violation Triggers:**
- Attempting to parse state ID as timestamp or sequence
- Assuming state ID contains embedded metadata
- Truncating state ID for display without preserving full ID

---

## SSM-INV-2: Descriptor Schema Strictness

> Semantic state descriptors must strictly conform to the schema. Unknown fields are rejected in strict mode.

**Schema:** `SemanticStateDescriptorSchema` (Zod)  
**Strict Mode:** `z.object({...}).strict()` (rejects unknown keys)

**Required Fields:**
- `modelId`: string, min 1 char
- `promptTemplateId`: string, min 1 char
- `promptTemplateVersion`: string, min 1 char
- `policySnapshotId`: string, min 1 char
- `contextSnapshotId`: string, min 1 char
- `runtimeId`: string, min 1 char

**Optional Fields:**
- `modelVersion`: string
- `evalSnapshotId`: string
- `metadata`: Record<string, unknown>

**Runtime Assertion:**
```typescript
// Enforced by Zod .parse()
const validated = SemanticStateDescriptorSchema.parse(input);
```

**Violation Triggers:**
- Adding unknown fields to descriptor
- Removing required fields
- Changing field types

---

## SSM-INV-3: Transition State Existence

> Transitions must reference existing states, except for genesis transitions which have no fromId.

**Rule:**
- `fromId`: optional (undefined for genesis)
- `toId`: required, must exist in store
- Both must be valid state IDs if present

**Runtime Assertion:**
```typescript
assertValidTransition(store: SSMStore, transition: SemanticTransition): void {
  if (transition.fromId !== undefined) {
    const fromState = store.getState(transition.fromId);
    if (!fromState) {
      throw new RequiemError({
        code: ErrorCode.SSM_TRANSITION_FROM_NOT_FOUND,
        message: `Transition references non-existent from state: ${transition.fromId}`,
        severity: 'error',
      });
    }
  }
  const toState = store.getState(transition.toId);
  if (!toState) {
    throw new RequiemError({
      code: ErrorCode.SSM_TRANSITION_TO_NOT_FOUND,
      message: `Transition references non-existent to state: ${transition.toId}`,
      severity: 'error',
    });
  }
}
```

---

## SSM-INV-4: Drift Classifier Determinism

> The drift classifier must be deterministic, stable, and side-effect free. Same inputs always produce same outputs.

**Function:** `classifyDrift(from, to)`  
**Properties:**
- Pure function (no side effects)
- Deterministic (same input → same output)
- Total (defined for all valid inputs)

**Drift Categories (ordered by significance):**
1. `model_drift` - Critical
2. `prompt_drift` - Critical (if ID change) / Major (if version change)
3. `policy_drift` - Major
4. `context_drift` - Minor
5. `eval_drift` - Minor
6. `runtime_drift` - Minor
7. `unknown_drift` - Cosmetic

**Runtime Assertion:**
```typescript
// In CI/tests - verify determinism
const result1 = classifyDrift(from, to);
const result2 = classifyDrift(from, to);
assert.deepEqual(result1, result2);
```

**Violation Triggers:**
- Using Date.now() in classifier
- Random tie-breaking
- Non-deterministic iteration order

---

## SSM-INV-5: Integrity Score Verifiability

> Integrity scores must only use verifiable signals. No heuristics or subjective measures.

**Signals (6 components, ~16.67 points each):**
| Signal | Verification Method |
|--------|---------------------|
| `parityVerified` | Output parity check passed |
| `policyBound` | `descriptor.policySnapshotId !== ''` |
| `contextCaptured` | `descriptor.contextSnapshotId !== ''` |
| `evalAttached` | `descriptor.evalSnapshotId` defined and non-empty |
| `replayVerified` | Replay verification passed |
| `artifactSigned` | Artifact signature valid |

**Formula:** `Math.round((signalsVerified / 6) * 100)`

**Invariant:** Score is always integer 0-100, computed deterministically.

**Runtime Assertion:**
```typescript
assertValidIntegrityScore(score: number): void {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new RequiemError({
      code: ErrorCode.SSM_INVALID_INTEGRITY_SCORE,
      message: `Integrity score must be integer 0-100, got ${score}`,
      severity: 'error',
    });
  }
}
```

**Violation Triggers:**
- Using subjective quality metrics
- Adding time-decay factors
- Non-deterministic scoring

---

## SSM-INV-6: Export Bundle Stability

> Export bundles must be stable (deterministic key ordering, schema versioning).

**Bundle Schema Version:** `1.0.0`  
**Required Properties:**
- JSON keys in alphabetical order
- ISO 8601 timestamps
- Deterministic array ordering

**Runtime Assertion:**
```typescript
assertStableBundle(bundle: SemanticLedgerBundle): void {
  // Verify version
  if (bundle.version !== '1.0.0') {
    throw new RequiemError({
      code: ErrorCode.SSM_UNSUPPORTED_BUNDLE_VERSION,
      message: `Bundle version ${bundle.version} is not supported`,
      severity: 'error',
    });
  }
  
  // Verify all states have valid IDs
  for (const state of bundle.states) {
    assertValidStateId(state.id);
  }
  
  // Verify timestamps are ISO 8601
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  if (!iso8601Regex.test(bundle.exportedAt)) {
    throw new RequiemError({
      code: ErrorCode.SSM_INVALID_TIMESTAMP,
      message: `Invalid exportedAt timestamp: ${bundle.exportedAt}`,
      severity: 'error',
    });
  }
}
```

---

## SSM-INV-7: Append-Only Storage

> States and transitions are append-only. Once written, they are never modified.

**Storage Operations:**
- `putState(state)`: Idempotent (same ID overwrites with same content)
- `appendTransition(transition)`: Pure append
- `importBundle(bundle)`: Merge (newer wins for states, dedupe for transitions)

**Invariant:** No operation modifies historical state.

**Runtime Assertion:**
```typescript
// In LocalSSMStore.putState
const existing = this.states.get(state.id);
if (existing) {
  // Verify content is identical
  if (JSON.stringify(existing) !== JSON.stringify(state)) {
    throw new RequiemError({
      code: ErrorCode.SSM_STATE_MUTATION_ATTEMPTED,
      message: `Attempted to mutate existing state: ${state.id}`,
      severity: 'error',
    });
  }
}
```

---

## SSM-INV-8: No Network Required

> Local store operations must work offline. No network calls in core storage.

**Enforcement:**
- LocalSSMStore uses only fs operations
- No HTTP requests in store implementation
- No cloud dependencies in core primitive

**Verification:**
```bash
# Disconnect network and verify
reach state list
reach state show <id>
reach state export
```

---

## Verification Matrix

| Invariant | Unit Test | Runtime Assert | CI Script | Schema | Branded Type |
|-----------|-----------|----------------|-----------|--------|--------------|
| SSM-INV-1 (Opaque ID) | ✅ | ✅ | verify:ssm | ✅ | SemanticStateId |
| SSM-INV-2 (Schema) | ✅ | ✅ | verify:ssm | ✅ | Zod schemas |
| SSM-INV-3 (Transition) | ✅ | ✅ | verify:ssm | - | - |
| SSM-INV-4 (Determinism) | ✅ | - | verify:ssm | - | - |
| SSM-INV-5 (Integrity) | ✅ | ✅ | verify:ssm | ✅ | - |
| SSM-INV-6 (Stability) | ✅ | ✅ | verify:ssm | ✅ | - |
| SSM-INV-7 (Append-Only) | ✅ | ✅ | verify:ssm | - | - |
| SSM-INV-8 (Offline) | - | - | verify:ssm | - | - |

---

## Invariant Change Process

### To Strengthen an Invariant

1. Create PR with justification
2. Code review
3. Update this document
4. Merge

### To Weaken an Invariant

1. Write ADR in `docs/decisions/SSM-INV-XX-adr.md`
2. Two reviewer sign-offs
3. Update this file with rationale comment
4. Notify security team

**Invariants may never be silently removed.**

---

## See Also

- `docs/reference/semantic-state-machine.md` - Core primitive documentation
- `docs/INVARIANTS.md` - System-wide invariants
- `docs/audits/SSM_COHERENCE_MAP.md` - Implementation map
