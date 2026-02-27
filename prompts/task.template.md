# Task Template — Requiem Governance Agent

Use this template when submitting a task to the governance agent. Fill in every
section. Omitting a section will cause the agent to reject the task with
`TASK_INCOMPLETE`.

---

## Task Description

<!-- One sentence: what needs to change and why. -->

## Affected Layer(s)

- [ ] Requiem OSS Engine (`src/`, `include/`, `tests/`)
- [ ] ReadyLayer Cloud (`ready-layer/`)
- [ ] CI / Governance (`scripts/`, `.github/`, `contracts/`)
- [ ] Cross-layer (requires `[cross-layer]` in PR title)

## Invariants Potentially Affected

<!-- List any invariant IDs from INVARIANTS.md that this task might touch. -->
<!-- e.g. INV-1 (Digest Parity), INV-5 (OSS isolation) -->

## Determinism Impact

- [ ] No determinism impact (no change to hash, serialization, or execution)
- [ ] Determinism-affecting — I have read and will follow the determinism
      change procedure in AGENTS.md

## Acceptance Criteria

<!-- How will you verify the task is complete? List the CI checks that must pass. -->

1. `scripts/verify_determinism.sh` passes (if engine changed)
2. `scripts/verify_routes.sh` passes (if routes changed)
3. `scripts/verify_boundaries.sh` passes (if layer boundaries touched)
4. `scripts/verify_deps.sh` passes (if dependencies changed)
5. `scripts/verify_migrations.sh` passes (if CAS/protocol/DB changed)
6. All existing CI checks remain green

## Rollback Plan

<!-- If this change causes a regression, how is it reverted? -->
<!-- e.g. "revert commit <hash>; re-run generate_golden_corpus.sh" -->

## PR Footer (required)

```
Layer: <engine|cloud|ci|cross-layer>
Invariants-Checked: <INV-N, INV-M, ...>
Determinism-Contract: <unchanged | bumped <field> <old> -> <new>>
Prompt-Lock-SHA256: <sha256 of prompts/system.lock.md — only if prompts changed>
```
