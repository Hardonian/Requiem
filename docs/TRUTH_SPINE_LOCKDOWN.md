# TRUTH SPINE LOCKDOWN

Centralized shared runtime truth utilities in `packages/core/src/truth-spine.ts`:

- `canonicalize(value)` → canonical JSON serialization
- `stableSort(items, compare)` → stable sorting with index tie-breaker
- `hashBytes(bytes)` / `hashObject(value)` → deterministic SHA-256 hashing
- `buildProblemJSON(options)` → consistent Problem+JSON payload

Adoption in this pass:

- `ready-layer/src/lib/problem-json.ts` now builds payloads via `buildProblemJSON`.
- `ready-layer/src/lib/big4-audit.ts` now hashes payloads via `hashObject`.

This removes duplicated canonicalization and payload-shape logic in ReadyLayer paths.
