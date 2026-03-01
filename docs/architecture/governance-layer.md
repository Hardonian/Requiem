# Governance Layer — Self-Correcting Deterministic Runtime

## Overview

This document defines the Self-Correcting Governance Layer for the Requiem runtime. It combines deterministic learning artifacts with economic symmetry tracking to enable safe, auditable runtime evolution.

## Architectural Invariants

### Core Determinism Invariants

1. **Deterministic execution is immutable**
   - Once an execution produces a fingerprint, it can never be altered
   - Replay must always produce identical output fingerprints
   - No runtime logic may depend on non-deterministic inputs (time, randomness, external state)

2. **Replay must produce identical output fingerprints**
   - Every runnable execution stores its complete input fingerprint
   - Replay validation compares output fingerprints byte-for-byte
   - Mismatch triggers a governance signal

3. **Learning may propose changes but never mutate runtime logic**
   - Learning outputs are artifacts only (signals, diagnoses, patches)
   - Patches require explicit human approval and CI verification
   - Never auto-apply patches to production

4. **Economic metrics must not influence execution results**
   - Cost tracking is read-only observation
   - Execution policy decisions are independent of economic state
   - Burn rate, storage costs, and policy eval load never affect runtime behavior

5. **All scoring functions must be pure and stable**
   - No randomness in scoring algorithms
   - Fixed thresholds for all classifications
   - Deterministic ordering of results

6. **All learning and economic artifacts must be tenant-scoped**
   - Every table includes tenant_id
   - Cross-tenant queries are forbidden
   - Tenant isolation verified by CI

7. **Patch proposals must be reviewable, versioned, and reversible**
   - Every patch includes rollback instructions
   - Patch status tracked: proposed → applied/rejected
   - Rollback plans stored alongside patches

## Learning Pipeline

### Signal Categories

| Category | Description | Threshold |
|----------|-------------|-----------|
| build_failure | Build step failed | 1 |
| drift | Behavior drift detected | 1 |
| policy_violation | Policy enforcement failure | 1 |
| replay_mismatch | Replay output differs | 1 |
| test_failure | Test suite failure | 1 |
| schema_gap | Missing or invalid schema | 1 |
| skill_gap | No skill handles signal | 1 |
| rollback_event | Rollback executed | 1 |
| cost_spike | Cost exceeds threshold | 1 |
| fairness_violation | Tenant imbalance detected | 1 |

### Root Cause Taxonomy

- **prompt_gap**: Required inputs missing from prompts
- **skill_gap**: No skill registered for signal category
- **schema_gap**: Schema validation failure
- **config_gap**: Configuration mismatch
- **policy_gap**: Policy enforcement gap
- **strategic_misalignment**: Runtime behavior diverges from intent
- **economic_misalignment**: Resource allocation inconsistent with policy

### Patch Types

| Type | Description | Auto-Apply |
|------|-------------|------------|
| skill_update | Create/update skill file | No |
| prompt_update | Modify prompt template | No |
| schema_update | JSON schema modification | No |
| config_update | Environment/verify config | No |
| branch_plan | New feature branch | No |
| rollback_plan | Revert to commit | No |
| cost_model_update | Cost thresholds | No |
| fairness_policy_update | Fairness thresholds | No |

## Economic Symmetry Layer

### Cost Model (Versioned)

```yaml
execution_unit: 1
: 1
replay_storage_unitpolicy_eval_unit: 1
drift_analysis_unit: 1
```

### Economic Events

| Event Type | Description |
|------------|-------------|
| execution | Standard run execution |
| replay_storage | Storing replay data |
| policy_eval | Policy evaluation |
| drift_analysis | Drift detection |

### Economic Alerts

| Alert Type | Severity Threshold |
|------------|-------------------|
| burn_spike | cost_units > threshold * 2 |
| storage_spike | storage_units > threshold * 2 |
| policy_spike | policy_units > threshold * 2 |
| fairness_violation | tenant_imbalance > 0.2 |

### Symmetry Metrics

#### Technical Symmetry
- **failure_recurrence_rate**: Signals per category / total signals
- **drift_severity_score**: Average severity_score from drift events
- **replay_mismatch_rate**: mismatches / total replays
- **time_to_green**: Average cycles to pass verification

#### Strategic Symmetry
- **rollback_frequency**: Rollbacks per period
- **skill_coverage_ratio**: Skills with coverage / total signals
- **instruction_coverage_score**: Verified instructions / total instructions

#### Economic Symmetry
- **burn_rate**: Total cost_units per period
- **cost_per_verified_run**: Total cost / successful runs
- **replay_efficiency_ratio**: Successful replays / total replays
- **fairness_index**: 1 - max_tenant_imbalance

## CLI Commands

### `reach learn`

```
reach learn --window=7d --format=table|json
```

Outputs:
- Top signals
- Diagnoses with confidence scores
- Proposed patches
- Risk ratings
- Rollback summaries

### `reach realign`

```
reach realign <patch-id>
```

Behavior:
- Creates branch `realign/<patch-id>`
- Applies patch diff
- Runs full verify suite
- Marks patch status = applied

Fails if:
- CI fails
- Determinism mismatch
- Replay mismatch

### `reach pivot`

```
reach pivot plan <name>
```

Creates:
- Branch strategy document
- Deprecated modules list
- Migration steps
- Rollback instructions

### `reach rollback`

```
reach rollback <sha|release>
```

Creates:
- Rollback branch
- Reset to target
- Verification report

### `reach symmetry`

```
reach symmetry
reach symmetry --economics
```

Outputs deterministic symmetry metrics.

### `reach economics`

```
reach economics
reach economics --alerts
reach economics --forecast
reach fairness
```

Outputs economic metrics and alerts.

## Registry Structure

### Skills (`/skills/`)

```json
{
  "id": "skill identifier",
  "scope": "execution|verification|policy",
  "triggers": ["signal_category"],
  "required_inputs": ["input_name"],
  "expected_outputs": ["output_pattern"],
  "verification_steps": ["step description"],
  "rollback_instructions": "how to revert",
  "version": "semver"
}
```

### Prompts (`/prompts/templates/`)

Template files with deterministic variable substitution.

### Schemas (`/artifacts/schemas/`)

JSON schemas for validation with version tracking.

## CI Enforcement

Required CI checks:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm prisma validate`
- `pnpm verify:boundaries`
- `pnpm verify:skills`
- `pnpm verify:schemas`
- `pnpm verify:economics`

Fails on:
- Non-deterministic scoring
- Missing rollback instructions
- Invalid registry entries
- Cross-tenant queries

## Verification

Run full suite:
```bash
pnpm verify:ci
```

Verify determinism:
```bash
pnpm verify:determinism
```

Verify tenant isolation:
```bash
pnpm verify:tenant-isolation
```
