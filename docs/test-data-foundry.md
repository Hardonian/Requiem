# Test Data Foundry

## Scope

The first ten deterministic datasets are implemented in `packages/testdata/src/datasets/*` and exposed through `rl dataset`.

Each dataset run has:

- `dataset_id` = stable hash of `(dataset_code, version, seed, schema_version)`
- `version`
- `seed`
- `schema_version`
- deterministic `items.jsonl`
- deterministic `labels.jsonl`
- deterministic `manifest.json`
- `checks.json` from validator checks

Artifacts are exported to:

- `./artifacts/<run_id>/manifest.json`
- `./artifacts/<run_id>/dataset.json`
- `./artifacts/<run_id>/items.jsonl`
- `./artifacts/<run_id>/labels.jsonl`
- `./artifacts/<run_id>/checks.json`

## Deterministic Means

In this repository, deterministic means byte-identical outputs for the same `(dataset_code, version, seed, tenant_id)`.

Rules enforced:

- canonical JSON serialization (stable key ordering)
- seeded RNG only (`mulberry32` wrapper)
- stable hash IDs (`sha256` over canonical JSON)
- fixed normalized timestamp (`recorded_at`)
- stable sort for registry and manifest file entries
- idempotent file-backed repository index (no duplicate logical dataset records)

## CLI

- `rl dataset list`
- `rl dataset gen <CODE> --seed <n> --out artifacts`
- `rl dataset validate <CODE> --seed <n>`
- `rl dataset replay <run_id|dataset_id> --out artifacts`

`tenant_id` for CLI defaults from `RL_TENANT_ID`, fallback `public-hardonian`.

## Implemented Dataset Codes

- `POL-TENANT-ISOLATION`: cross-tenant read denials
- `POL-ROLE-ESCALATION`: viewer denied admin actions
- `TOOL-SCHEMA-STRESS`: deterministic invalid payload matrix
- `ADV-INJECT-BASIC`: prompt injection refusal routing
- `ADV-PATH-TRAVERSAL`: path traversal block checks
- `REPO-DAG-CIRCULAR`: five-node cycle detection proof
- `CLI-PIPE-PRESSURE`: 10MB streaming memory-bound checks
- `PERF-COLD-START`: cold-start baseline schema runs
- `FAULT-OOM-SCENARIO`: 100MB request rejection envelope checks
- `TRACE-ROUNDTRIP`: receipt/replay hash parity

## Add Dataset #11

1. Create `packages/testdata/src/datasets/<new_code>.ts` exporting `dataset: DatasetDefinition`.
2. Fill metadata with `code`, `version`, `schema_version`, and explicit `labels_schema`.
3. Implement deterministic `generate`, `label`, and `validate` (no `Date.now()` or `Math.random()`).
4. Register it in `packages/testdata/src/datasets/index.ts`.
5. Run:
   - `pnpm rl dataset gen <NEW_CODE> --seed 1337`
   - `pnpm rl dataset validate <NEW_CODE> --seed 1337`
6. Add it to CI smoke if needed.

## Storage

Foundry uses a file-backed repository abstraction at `artifacts/.foundry-store/index.json`.

- If a matching key `(dataset_code, version, seed, tenant_id)` exists, the existing dataset record is reused.
- This keeps generation idempotent while allowing replay by `run_id` or `dataset_id`.

## Current Limitations

- DB-backed foundry storage is not enabled in this slice; file-backed repository is used.
- Validators are smoke-level deterministic harnesses, not full production traffic replay.
