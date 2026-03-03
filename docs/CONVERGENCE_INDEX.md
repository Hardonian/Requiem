# CONVERGENCE_INDEX.md

This index maps runtime invariants to their spec anchors, implementation locations, and verification coverage.

## Invariants

| Invariant | Spec Ref | Code Location | Coverage | State |
| --- | --- | --- | --- | --- |
| Typed envelope boundaries | `docs/KERNEL_SPEC.md` (envelope/error semantics) | `src/cli.cpp`, `src/envelope.cpp`, `ready-layer/src/app/api/**/route.ts` | `pnpm verify:web`, `pnpm verify:replay` | IMPLEMENTED |
| Deterministic hash/encoding | `docs/KERNEL_SPEC.md` (determinism + hashing) | `src/hash.cpp`, `src/jsonlite.cpp`, `src/plan.cpp` | `pnpm test`, `pnpm verify:replay` | IMPLEMENTED |
| CAS integrity | `docs/KERNEL_SPEC.md` (CAS + integrity) | `src/cas.cpp` | `pnpm verify:integrity`, `pnpm test` | IMPLEMENTED |
| Event chain integrity | `docs/KERNEL_SPEC.md` (event log chain) | `src/event_log.cpp` | `pnpm verify:replay`, `pnpm verify:demo` | IMPLEMENTED |
| Capability gating | `docs/KERNEL_SPEC.md` (capability model) | `src/caps.cpp`, `src/cli.cpp` | `pnpm verify:integrity` | IMPLEMENTED |
| Policy path determinism | `docs/KERNEL_SPEC.md` (policy engine) | `src/runtime.cpp`, `src/policy_vm.cpp`, `ready-layer/scripts/verify-policy.ts` | `pnpm verify:policy` | IMPLEMENTED |
| Replay exactness for same inputs | `docs/KERNEL_SPEC.md` (replay invariant) | `src/plan.cpp`, `src/receipt.cpp` | `pnpm verify:replay`, `pnpm verify:demo` | IMPLEMENTED |
| Web route stability (no hard crash in build/smoke) | `docs/VERTICAL_SLICE.md` | `ready-layer/src/app/**`, `ready-layer/tests/console-route-smoke.test.ts` | `pnpm --filter ready-layer build`, `pnpm --filter ready-layer test`, `pnpm verify:web` | IMPLEMENTED |

## Primitive to Surface Map

| Primitive | Kernel Module | CLI Command Surface | Web Surface | State |
| --- | --- | --- | --- | --- |
| CAS | `src/cas.cpp` | `cas *` | `/api/objects`, `/api/cas/integrity` | IMPLEMENTED |
| Policy | `src/policy_vm.cpp`, `src/runtime.cpp` | `policy *`, `budget *` | `/api/policies`, `/api/budgets` | IMPLEMENTED |
| Capability | `src/caps.cpp` | `cap *`, `caps *` | `/api/caps` | IMPLEMENTED |
| Plan + receipt + replay | `src/plan.cpp`, `src/receipt.cpp` | `plan *`, `receipt *` | `/api/plans`, `/api/runs`, `/api/replay/verify` | IMPLEMENTED |
| Log integrity | `src/event_log.cpp` | `log *` | `/api/logs` | IMPLEMENTED |

## Drift Notes Closed in This Pass

- Verification scripts in `ready-layer/scripts/` were out of sync with current CLI argument contracts and output shapes.
- `ready-layer` had no runnable Vitest tests (`No test files found`).
- These drifts were closed by script contract alignment and adding a route smoke suite.
