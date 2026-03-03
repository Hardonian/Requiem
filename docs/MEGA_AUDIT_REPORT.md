# MEGA_AUDIT_REPORT.md

Date: 2026-03-02  
Scope: root kernel/CLI + `ready-layer` web app  
Method: command-driven convergence audit against current executable behavior

## High / Blocker Findings (Actionable)

| # | Severity | Finding | Reproduction | Smallest Safe Fix | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | BLOCKER | `tsx` IPC socket failure on WSL temp mount (`ENOTSUP`) blocked verify scripts | run `pnpm verify:*` with temp path under `/mnt/.../Temp/...pipe` | add cross-platform wrapper `scripts/run-tsx.mjs` forcing Linux temp dirs to `/tmp` when needed | FIXED |
| 2 | BLOCKER | stale CMake cache path mismatch (`C:/...` vs `/mnt/c/...`) caused build failures | run `pnpm build` after switching env between Windows/WSL | add `scripts/cmake-build.sh` to detect mismatch and clean cache safely before configure | FIXED |
| 3 | HIGH | hard dependency on zstd config caused configure failure on hosts without zstd package | run CMake on host without `zstdConfig.cmake` | make zstd optional in `CMakeLists.txt` (config + pkg-config fallback + warning path) | FIXED |
| 4 | HIGH | reproducible-build flags were applied without compiler capability checks | run configure/build with unsupported flags | gate flags with `CheckCCompilerFlag` / `CheckCXXCompilerFlag` in `CMakeLists.txt` | FIXED |
| 5 | HIGH | unresolved sandbox config symbols at link time | run release link target `requiem` | add missing implementation file `src/sandbox_config.cpp` and include in target | FIXED |
| 6 | HIGH | Linux seccomp build break (`off_syscall`/undefined helper path) | run Linux build of `sandbox_posix.cpp` | replace offset with `offsetof(struct seccomp_data, nr)`, remove broken helper, include `<cstddef>` | FIXED |
| 7 | HIGH | CAS meta corruption path was not validated in `get()` causing false integrity acceptance | corrupt sidecar metadata then run CAS read path | validate sidecar parse and required fields; enforce sidecar hash checks | FIXED |
| 8 | HIGH | CAS repair flow could leave corrupted local object before re-put | run CAS repair on tampered local object | remove corrupted local object prior to re-put in `repair()` | FIXED |
| 9 | HIGH | protocol harness recomputed digests inconsistently with canonical result hashing | run protocol harness determinism checks | align digest recomputation to canonical result hash helper | FIXED |
| 10 | HIGH | debugger implementation was effectively a stub, breaking replay/chaos debugging paths | run debugger-dependent harnesses | replace stub with minimal functional debugger load/seek/step/diff implementation | FIXED |
| 11 | HIGH | web verify scripts drifted from actual CLI contracts (flags/output schema mismatch) | run `pnpm verify:integrity|policy|replay` | rewrite scripts to current CLI flags + envelope/raw normalization + stateless assertions | FIXED |
| 12 | HIGH | `ready-layer` test gate failed (`No test files found`) | run `pnpm --filter ready-layer test` | add concrete route smoke test suite (`tests/console-route-smoke.test.ts`) | FIXED |

## Notes

- Remaining warnings in this environment are non-blocking runtime/toolchain warnings:
  - Node engine warning (`project expects >=20.11`, runtime observed: Node 18.19)
  - Next.js lint plugin warning in build output
  - Supabase deprecation warning for Node 18
- These warnings did not block lint/typecheck/test/build/verify outcomes in this pass.
