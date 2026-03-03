# Test Data Foundry Architecture

The Foundry extends existing Requiem primitives by storing deterministic dataset metadata in `.requiem/foundry/*.ndjson` and reusing existing verification commands (`verify:routes`, `verify:replay`, `verify:policy`, `verify:determinism`) as executable vectors.

## Primitive map
- **Run envelope / replay export**: vector entries call existing replay verification scripts via CLI (`pnpm run verify:replay`).
- **Audit store**: expected outcomes include audit invariants (`expected_audit_events`) and trace IDs on every item result.
- **Drift vectors**: core vectors include drift checks, and run summaries include drift counts.
- **Storage backends**: memory (in-process lists), file (`ndjson` store), and optional DB compatibility via export surfaces.
- **CLI/Web/CI integration**: `requiem foundry ...` command surface, `/api/foundry/*` endpoints, `/intelligence/foundry*` pages, and CI workflow job.

## Persistence
- `datasets.ndjson`: dataset metadata.
- `dataset_items.ndjson`: deterministic, versioned case items.
- `dataset_runs.ndjson`: run summaries + item-level results + trace IDs.

## Determinism controls
- Stable IDs generated from SHA-256 of canonical input.
- Stable ordering by `dataset_id`/`item_id` before persistence and execution.
- Explicit seeds persisted in both dataset and item records.

## Code links
- CLI command + orchestration: `packages/cli/src/commands/foundry.ts`
- Models: `packages/cli/src/foundry/types.ts`
- Storage repos: `packages/cli/src/foundry/repo.ts`
- Vector execution: `packages/cli/src/foundry/vectors.ts`
- Web API/UI: `ready-layer/src/app/api/foundry/*`, `ready-layer/src/app/intelligence/foundry/*`
