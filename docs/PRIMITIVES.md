# PRIMITIVES.md

This document maps kernel primitives to their implementation points and verification coverage.

## Primitive Map

| Primitive | Canonical Implementation | Surface Commands | Verification Evidence | Status |
| --- | --- | --- | --- | --- |
| Canonical JSON encoding | `src/jsonlite.cpp` | used by envelopes, plan/policy/receipt serialization | `pnpm test`, `pnpm verify:replay` | IMPLEMENTED |
| Domain-separated hashing (BLAKE3) | `src/hash.cpp` | `digest file`, CAS/plan/receipt hash paths | `pnpm test` | IMPLEMENTED |
| CAS object store + integrity | `src/cas.cpp` | `cas put/get/ls/info/verify/gc` | `pnpm verify:integrity`, `pnpm test` | IMPLEMENTED |
| Event log chained integrity | `src/event_log.cpp` | `log tail/read/search/verify` | `pnpm verify:replay`, `pnpm verify:demo` | IMPLEMENTED |
| Typed envelopes | `include/requiem/envelope.hpp`, `src/envelope.cpp`, `src/cli.cpp` | all CLI responses, API responses | `pnpm verify:web`, `pnpm verify:replay` | IMPLEMENTED |
| Capability issue/verify/revoke | `src/caps.cpp`, `src/cli.cpp` | `cap keygen/mint/verify/revoke`, `caps list` | `pnpm verify:integrity` | IMPLEMENTED |
| Policy evaluation path | `src/runtime.cpp`, `src/policy_vm.cpp`, `src/cli.cpp` | `policy add/list/eval/versions/test/vm-eval` | `pnpm verify:policy` | IMPLEMENTED |
| Budget enforcement surface | `src/metering.cpp`, `src/cli.cpp` | `budget set/show/reset-window` | `pnpm verify:policy` | IMPLEMENTED |
| Plan DAG + deterministic run | `src/plan.cpp`, `src/cli.cpp` | `plan verify/hash/run/replay` | `pnpm verify:replay`, `pnpm verify:demo` | IMPLEMENTED |
| Receipt formation and verification | `src/receipt.cpp`, `src/cli.cpp` | `receipt show/verify`, plan run outputs | `pnpm verify:replay`, `pnpm verify:demo` | IMPLEMENTED |
| Snapshot surface | `src/snapshot.cpp`, `src/cli.cpp` | `snapshot create/list/restore` | `pnpm verify:replay` | IMPLEMENTED |

## Boundary Contract

- Kernel executable: `./build/requiem`
- Web console/API: `ready-layer/`
- Shared safety requirement: typed error envelopes and no secret leakage in normal output paths.

## Required Verify Set

```bash
pnpm verify:boundaries
pnpm verify:integrity
pnpm verify:policy
pnpm verify:replay
pnpm verify:web
```
