# Category Collapse Risk Audit

## The Critique

> "Reach is an over-engineered CI/policy wrapper; 90% of ROI can be replicated with GitHub Actions + OPA + Postgres."

## Where We Look Like a "CI Wrapper"

| Current Feature | CI Wrapper Signal | Differentiation Gap |
|----------------|-------------------|---------------------|
| `reach run` → execute tool | Like `gha run workflow` | No semantic state tracking |
| `reach verify` → check hash | Like `opa test` | No lineage or transition history |
| `reach replay` → re-execute | Like `gha rerun` | No drift taxonomy |
| Policy enforcement | Like OPA sidecar | No policy-bound state snapshots |
| Audit logs | Like GHA job logs | No verifiable state machine |

## Where We Already Have Unique Primitives

1. **Deterministic Fingerprinting** (`packages/ai/src/memory/hashing.ts`)
   - BLAKE3-based content hashing
   - Normalized serialization for stable IDs
   - Already used for replay verification

2. **State Machine** (`packages/cli/src/lib/state-machine.ts`)
   - Generic state machine with transition validation
   - PostgreSQL trigger generation
   - NOT currently used for semantic AI state

3. **Drift Detection** (`packages/cli/src/lib/drift-detector.ts`)
   - Signal categorization and analysis
   - Root cause determination
   - NOT tied to semantic state transitions

4. **Policy Snapshots** (`packages/cli/src/lib/policy-snapshot.ts`)
   - Policy hash capture at decision time
   - NOT bound to semantic state IDs

## What Is Missing to Make "Semantic State Machine" Real

### Core Primitive Gaps

| Missing Component | Why It Matters | GitHub Actions + OPA Equivalent |
|-------------------|----------------|--------------------------------|
| Semantic State ID | Stable identifier for AI execution context | None (only workflow run IDs) |
| Semantic State Descriptor | Structured record of model, prompt, policy, context | None (scattered in workflow YAML) |
| State Transition Ledger | Append-only record of semantic changes | Audit logs (not queryable by semantics) |
| Drift Taxonomy | Classification of what changed between states | Manual diffing |
| Integrity Score | Verifiable metric of state trustworthiness | None |
| Model Migration Simulation | Predict impact of model changes | Manual testing |

### CLI Gaps

- No `reach state` command family
- No semantic diff between executions
- No state lineage visualization
- No migration simulation

### UI Gaps

- No semantic ledger view
- No transition graph
- No drift taxonomy display
- No integrity score visualization

## The Differentiation Strategy

Transform from "CI wrapper with extra steps" to **"Semantic State Machine for AI Executions"**:

1. **State-First Mental Model**: Users think in states, not runs
2. **Verifiable Lineage**: Every state has a cryptographic identity
3. **Governance at Semantics**: Policy bound to semantic state, not just execution
4. **Migration as First-Class**: Model changes are state transitions to simulate

## Success Criteria

The differentiation is real when:

- [ ] `reach state diff <idA> <idB>` shows semantic drift taxonomy
- [ ] `reach state list` filters by model, policy, integrity score
- [ ] `reach simulate upgrade --from <modelA> --to <modelB>` predicts impact
- [ ] UI shows semantic ledger with lineage graph
- [ ] Every state has a stable, verifiable ID
- [ ] Policy snapshots are bound to states

## Why GitHub Actions + OPA Cannot Replicate This

| Capability | GHA + OPA | Reach SSM |
|------------|-----------|-----------|
| Semantic State ID | Workflow run ID (time-based) | Content-derived fingerprint |
| State Lineage | Job dependencies (structural) | Semantic transitions (intent) |
| Drift Taxonomy | Manual diff | Automated classification |
| Model Migration | Full re-test | Simulation + selective re-eval |
| Integrity Score | None | Computed from verifiable signals |
| Policy Bound to State | Sidecar check | Snapshot hash in descriptor |

The key difference: **GHA models CI/CD pipelines; Reach models AI execution semantics.**
