# Golden Corpus — Determinism Test Fixtures

This directory contains canonical input/output pairs used to verify that the
Requiem engine and its AI control plane produce **byte-for-byte identical outputs**
for identical inputs across any number of sequential or concurrent re-executions.

## Purpose

Golden fixtures pin the observable behaviour of:

| File | What it pins |
|---|---|
| `exec_request_canon.json` | Canonical C++ engine execution request and its expected BLAKE3 `result_digest` |
| `policy_decision_canon.json` | Canonical policy-gate input → output pair (synchronous `evaluatePolicy`) |
| `budget_state_canon.json` | Canonical budget check input/output with a fixed clock value |

## Conventions

- All digests are lowercase BLAKE3 hex (64 chars).
- The `_meta.generated_by` field records the script that produced the fixture.
- The `_meta.contract_version` must match `contracts/determinism.contract.json → contract_version`.
- To regenerate: run `scripts/generate_golden_corpus.sh` and commit the result.
- CI verifies these files unchanged via `scripts/verify_determinism.sh`.

## Adding a new fixture

1. Add the file to this directory following the existing naming convention.
2. Record the expected digest in `_meta.expected_digest` (if applicable).
3. Add a loader + assertion to `packages/ai/src/policy/__tests__/determinism.test.ts`.
4. Update `contracts/determinism.contract.json → golden_corpus.categories` if a new category is needed.
