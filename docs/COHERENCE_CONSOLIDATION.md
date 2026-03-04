# Coherence Consolidation (Updated)

## Consolidations completed

1. **CLI binary resolution primitive shared across demo tools**
   - Added `scripts/lib/cli-path.ts` and reused it in both `demo-doctor` and `demo-run`.
   - Eliminates duplicated OS-specific path logic and inconsistent fallback behavior.

2. **Single source of truth for route hardening checks**
   - Added `verify-problem-json.ts` for contract consistency.
   - Added `verify-tenant-body.ts` for tenant source enforcement.
   - Wired both into `verify:routes` and CI chain for deterministic enforcement.

3. **Unified test-lane semantics**
   - Introduced `test:smoke` and `test:stress` scripts.
   - Set `test` to smoke lane to keep developer path consistent and fast while preserving stress coverage.

4. **Runtime route contract assertion utility**
   - Added shared `expectProblemContract(...)` helper in route runtime verifier to avoid repeated, inconsistent assertions.

## Net effect
- Clearer operator expectations (`test` vs `test:stress`).
- Fewer environment-specific failures (CLI discovery).
- Stronger and more coherent enforcement for error contracts and tenant isolation boundaries.
