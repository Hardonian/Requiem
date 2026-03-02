# MEGA AUDIT REPORT

**Date**: 2026-03-02
**Repository**: Requiem (c:/Users/scott/GitHub/Requiem)
**Mode**: CODE - MASSIVE CODEBASE REVIEW → AUDIT → QA → REFACTOR

---

## 1. CORRECTNESS / DETERMINISM

### 1.1 Wall-Clock Usage in Kernel Paths (BLOCKER)

**Finding**: `std::chrono::system_clock::now()` and `std::time(nullptr)` used in multiple places

| File                | Line          | Usage                                       | Severity |
| ------------------- | ------------- | ------------------------------------------- | -------- |
| `src/rbac.cpp`      | 153-154       | Capability expiration check uses wall-clock | HIGH     |
| `src/cas.cpp`       | 348, 653, 981 | Timestamps in CAS metadata                  | MED      |
| `src/snapshot.cpp`  | 49-50         | Snapshot timestamps                         | LOW      |
| `src/event_log.cpp` | 113-118       | Event timestamps (not in hash)              | LOW      |

**Issue**: RBAC uses `system_clock::now()` for capability expiration verification. If time is used in the critical path for capability verification, it can lead to non-deterministic behavior.

**Reproduction**:

```bash
cd c:/Users/scott/GitHub/Requiem/build/Release
requiem_tests.exe
# Look for test failures related to time-sensitive operations
```

**Proposed Fix**: Use logical/sequence numbers for expiration instead of wall-clock, or document that RBAC is intentionally time-dependent.

---

### 1.2 Nondeterministic ID Generation in Web API (HIGH)

**Finding**: 32 instances of `Math.random()` and `Date.now()` in TypeScript API routes

| File                                         | Pattern                                                              | Severity |
| -------------------------------------------- | -------------------------------------------------------------------- | -------- |
| `ready-layer/src/app/api/snapshots/route.ts` | `policy_hash: pol_${Date.now().toString(36)}_${Math.random()...}`    | HIGH     |
| `ready-layer/src/app/api/policies/route.ts`  | `snapshot_hash: snap_${Date.now().toString(36)}_${Math.random()...}` | HIGH     |
| `ready-layer/src/app/api/plans/route.ts`     | `plan_hash: plan_${Date.now().toString(36)}_${Math.random()...}`     | HIGH     |
| Multiple route files                         | `generateTraceId()` uses non-deterministic values                    | HIGH     |

**Issue**: Mock API responses use non-deterministic IDs. This breaks determinism guarantees.

**Reproduction**:

```bash
# Run the same API call twice and compare response hashes
curl http://localhost:3000/api/policies | sha256
curl http://localhost:3000/api/policies | sha256
# Different hashes!
```

**Proposed Fix**: Replace with deterministic hashes based on content, or use crypto.randomUUID() for trace IDs.

---

### 1.3 CAS Compact Test Failure (BLOCKER)

**Finding**: Test `test_cas_compact()` fails with "index should have 2 lines after compact"

| File                          | Issue                                     |
| ----------------------------- | ----------------------------------------- |
| `tests/requiem_tests.cpp:414` | Assertion expects 2 lines after compact   |
| `src/cas.cpp:486-513`         | compact() function may reload stale index |

**Root Cause**: The `compact()` function at line 487-488 calls `load_index()` if `index_loaded_` is false. This may reload from disk, which still has all 3 entries (remove only updates memory, not disk).

**Reproduction**:

```bash
cd c:/Users/scott/GitHub/Requiem/build/Release
requiem_tests.exe
# Look for: CAS compact...FAIL: index should have 2 lines after compact
```

**Proposed Fix**: The compact() function should use the in-memory index directly, not reload from disk.

---

## 2. ARCHITECTURE + BOUNDARIES

### 2.1 Stale CLI Build (BLOCKER)

**Finding**: CLI `dist/` folder is stale - missing 46 commands

| Issue                    | Evidence                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| Source has 50+ commands  | `packages/cli/src/commands/` contains 52 files                                 |
| Dist has only 4 commands | `packages/cli/dist/commands/` has agent, ai, decide, junctions                 |
| All CLI commands fail    | `ERR_MODULE_NOT_FOUND: Cannot find module 'packages/cli/dist/commands/decide'` |

**Reproduction**:

```bash
cd c:/Users/scott/GitHub/Requiem
pnpm run verify:contracts
# All 40 commands fail with module not found
```

**Proposed Fix**: Rebuild CLI: `pnpm --filter @requiem/cli build`

---

### 2.2 CTest Configuration (MEDIUM)

**Finding**: 8 C++ tests cannot find executables

| Test              | Error                           |
| ----------------- | ------------------------------- |
| stress_harness    | Cannot find executable: requiem |
| shadow_runner     | Cannot find executable: requiem |
| billing_harness   | Cannot find executable: requiem |
| security_gauntlet | Cannot find executable: requiem |
| recovery_harness  | Cannot find executable: requiem |
| memory_harness    | Cannot find executable: requiem |
| protocol_harness  | Cannot find executable: requiem |
| chaos_harness     | Cannot find executable: requiem |

**Root Cause**: CTest is looking in the wrong path - executables are in `build/Release/` but CTest expects them in `build/`

**Reproduction**:

```bash
cd c:/Users/scott/GitHub/Requiem
pnpm run test
# 8 tests fail with "Cannot find executable"
```

**Proposed Fix**: Fix CTest configuration in `build/CTestTestfile.cmake` or rebuild with correct paths.

---

### 2.3 Missing Script (HIGH)

**Finding**: `scripts/verify_determinism.ts` does not exist

| Script                  | Status         |
| ----------------------- | -------------- |
| `verify_determinism.ts` | File not found |

**Reproduction**:

```bash
cd c:/Users/scott/GitHub/Requiem
pnpm run verify:determinism
# Error: Cannot find module 'scripts/verify_determinism.ts'
```

**Proposed Fix**: Create the script or restore from version control.

---

## 3. RELIABILITY + ERROR HANDLING

### 3.1 API Error Handling (MEDIUM)

**Finding**: Most API routes return typed error envelopes (good), but some return raw 500s

| Route                                       | Status | Envelope Type                                  |
| ------------------------------------------- | ------ | ---------------------------------------------- |
| `ready-layer/src/app/api/caps/route.ts`     | ✅     | Typed `ApiResponse<null>` with `createError()` |
| `ready-layer/src/app/api/policies/route.ts` | ✅     | Typed `ApiResponse<null>` with `createError()` |
| `ready-layer/src/app/api/plans/route.ts`    | ✅     | Typed envelope                                 |
| `ready-layer/src/middleware/proxy.ts`       | ⚠️     | Hard 500 at line 153                           |

**Reproduction**: Check source code - errors at line 153 in proxy.ts return hard 500.

**Proposed Fix**: Wrap in typed error envelope.

---

### 3.2 Console.\* in Production (MEDIUM)

**Finding**: Extensive use of `console.log/error/warn` in production code

**Evidence**:

- `verify-no-console.ts` script exists to detect this violation
- `codemod-console-to-logger.ts` exists to fix it
- But many violations remain

**Reproduction**:

```bash
cd c:/Users/scott/GitHub/Requiem
npx tsx scripts/verify-no-console.ts
# Reports violations
```

**Proposed Fix**: Run the codemod: `npx tsx scripts/codemod-console-to-logger.ts`

---

## 4. SECURITY

### 4.1 Secret Leakage (LOW)

**Finding**: No obvious secret leakage detected in code review. The codebase has:

- Environment validation in `ready-layer/src/lib/env.ts`
- Proper error handling that doesn't leak stack traces in AI errors
- Auth middleware with proper 401/403 responses

**Status**: ✅ PASS

---

## 5. PERFORMANCE

### 5.1 No Obvious O(n²) Patterns Found

**Status**: Quick scan of hot paths shows no obvious O(n²) loops.

---

## 6. DEVELOPER ERGONOMICS

### 6.1 Inconsistent ID Generation (MEDIUM)

**Finding**: Multiple ID generation patterns in use

| Pattern                                                                | Usage      | Location                                        |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| `crypto.randomUUID()`                                                  | Production | `ready-layer/src/app/app/executions/wrapper.ts` |
| `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` | Mock APIs  | Most API routes                                 |
| Custom hash functions                                                  | C++        | Various                                         |

**Proposed Fix**: Standardize on deterministic content-based IDs for data, crypto.randomUUID() for correlation IDs only.

---

## PRIORITY MATRIX

| Priority | Count | Items                                                                |
| -------- | ----- | -------------------------------------------------------------------- |
| BLOCKER  | 3     | CAS compact test, Stale CLI build, Missing script                    |
| HIGH     | 3     | Wall-clock in RBAC, Nondeterministic IDs, Missing verify_determinism |
| MED      | 4     | CTest config, Console.\* usage, API error handling, Inconsistent IDs |
| LOW      | 1     | Snapshot/event timestamps (documented as not in hash)                |

---

## TOP 10 ACTION ITEMS

1. **Fix CAS compact test** - `src/cas.cpp` compact() reloads stale index
2. **Rebuild CLI** - `pnpm --filter @requiem/cli build`
3. **Restore/create verify_determinism.ts** - Check version control
4. **Replace Math.random() with deterministic IDs** - In all API mock routes
5. **Fix CTest executable paths** - Update build configuration
6. **Migrate console._ to logger._** - Run codemod
7. **Review wall-clock in RBAC** - Determine if intentional
8. **Standardize ID generation** - Pick one pattern
9. **Add typed error wrapper** - For proxy.ts hard 500
10. **Verify determinism after fixes** - Run full test suite
