# Performance Baseline (Updated)

## Before → After summary for this patch set

| Area | Before | After |
|---|---|---|
| Default test loop | `pnpm test` included `stress_harness` in primary lane | `pnpm test` now maps to `test:smoke` (stress moved to `test:stress`) |
| Demo preflight | Doctor failed when CLI was built locally but not discoverable via PATH | Doctor resolves workspace build binaries first, then PATH fallback |
| Route contract checks | Runtime checks validated status codes only | Runtime checks validate Problem+JSON contract fields (status/content-type/title/trace_id) |
| Determinism gate wiring | Determinism script existed but no quick CI smoke command | `verify:determinism-smoke` added and wired into CI verify chain |

## Observed timings in this environment

| Command | Observation |
|---|---|
| `pnpm lint` | ~10s |
| `pnpm typecheck` | ~13s |
| `pnpm build` | ~7s incremental (full build is significantly longer) |
| `pnpm test` (smoke) | ~99s total in this environment |
| `pnpm verify:routes` | ~27s including dev server spin-up |
| `pnpm verify:determinism-smoke` | ~4s |

## Operator impact
- Faster default local loop (`pnpm test`) without sacrificing stress coverage (`pnpm run test:stress`).
- Fewer false negatives in demo preflight due to robust CLI resolution.
- Stronger route-level contract verification for error consistency and traceability.
