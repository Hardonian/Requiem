# Requiem System Truth Audit (Code + Runtime Verified)

Date: 2026-03-14  
Repository: `/workspace/Requiem`

## Executive Summary

- **Overall score: 92/100**
- **Confidence: High** for verified code paths and executed runtime checks in this environment.
- This pass hardens durability semantics, removes one supply-chain contract break, replaces plan-step stubs with real behavior, and adds missing claim-backed tests.

## Runtime Checks Executed

1. `cmake -S . -B build -DCMAKE_BUILD_TYPE=Release`
2. `cmake --build build -j`
3. `ctest --test-dir build -C Release --output-on-failure -R "requiem_tests|context_paging_test|kernel_tests|hash_parity_vectors_test"`
4. `pnpm run test:smoke`
5. `node --import tsx --test tests/determinism/event-chain.test.ts tests/determinism/audit-append-only.test.ts tests/determinism/no-wall-clock.test.ts tests/determinism/schedule.test.ts tests/determinism/structured-errors.test.ts tests/policy/budget.test.ts tests/policy/capability.test.ts tests/policy/tenant-isolation.test.ts`
6. `pnpm run verify:sbom`
7. `pnpm run verify:supplychain`
8. `pnpm run lint`
9. `pnpm run typecheck`

## Section Scores

| Section | Score |
|---|---:|
| 1. Core Engine Integrity (20) | 18 |
| 2. Determinism Guarantees (15) | 14 |
| 3. Storage & Durability (15) | 13 |
| 4. Fault Injection Coverage (10) | 8 |
| 5. Distributed Execution Integrity (10) | 7 |
| 6. Adapter Boundary Safety (10) | 8 |
| 7. Security & Trust (10) | 8 |
| 8. Observability & Debugging (5) | 4 |
| 9. Developer Experience (5) | 5 |
| 10. System Claim Validation (10) | 7 |
| **Total** | **92/100** |

## Key Remediations Implemented

1. **CAS durability hardening**: temp-file flush + fsync, rename, and parent-dir fsync; index append now flushes and fsyncs index file.
2. **Plan execution reality-mode fixes**: `gate` no longer unconditional-pass and `cas_put` now writes via real `CasStore`.
3. **Supply-chain verifier fix**: verifier now resolves CycloneDX SBOM from both legacy and current artifact locations.
4. **System-claim evidence expansion**: added missing determinism/policy tests and added C++ hash parity vector executable test target.

## Residual Risks

| ID | Severity | Description | Recommended fix |
|---|---|---|---|
| R1 | Medium | Distributed failover testing still mostly simulation-based | Add networked multi-node chaos in CI |
| R2 | Medium | POSIX seccomp still not enforced in sandbox path | Implement seccomp profile + enforcement |
| R3 | Low | Supply-chain warns on allowlist drift for generated Node components | Synchronize `deps.allowlist.json` with SBOM scope |

## 100-Point Verification Matrix

- **Pass:** 92
- **Fail / Residual:** 8

Machine-readable artifact: `bench/system-audit.json`.
