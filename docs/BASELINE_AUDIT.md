# BASELINE AUDIT REPORT

**Date**: 2026-03-02
**Repository**: Requiem (c:/Users/scott/GitHub/Requiem)
**Mode**: CODE - MASSIVE CODEBASE REVIEW → AUDIT → QA → REFACTOR

---

## 0.1 REPO TOPOLOGY

### Packages/Apps/Libs

- **C++ Core** (`src/`, `include/requiem/`) - Deterministic runtime engine with CAS, metering, policy enforcement
- **CLI Package** (`packages/cli/`) - TypeScript CLI with 50+ commands
- **AI Package** (`packages/ai/`) - AI evaluation and adversarial testing
- **UI Package** (`packages/ui/`) - Design system components
- **ReadyLayer** (`ready-layer/`) - Next.js web application

### Build System

- **C++**: CMake 3.20+ with C++20
- **TypeScript/JS**: pnpm workspaces with pnpm@8.15.0
- **Web**: Next.js 16.x

### Key Entrypoints

- C++ CLI: `src/cli.cpp`
- TypeScript CLI: `packages/cli/src/cli.ts`
- Web App: `ready-layer/src/app/`

---

## 0.2 BASELINE COMMAND RESULTS

### ✅ PASS: `pnpm run lint`

```
> pnpm --filter ready-layer lint
> eslint .
(0 errors, 0 warnings)
```

### ✅ PASS: `pnpm run typecheck`

```
> npx tsc --project ready-layer/tsconfig.json --noEmit
(0 errors)
```

Note: npm warnings about deprecated pnpm config (not errors)

### ⚠️ PARTIAL PASS: C++ Tests

```
> ctest -C Release --output-on-failure
```

| Test | Status | Notes |
|------|--------|-------|
| requiem_tests | ❌ FAIL | CAS compact test: "index should have 2 lines after compact" |
| context_paging_test | ✅ PASS | |
| kernel_tests | ✅ PASS | 29 tests passed |
| stress_harness | ❌ NOT RUN | Missing `requiem` executable |
| shadow_runner | ❌ NOT RUN | Missing `requiem` executable |
| billing_harness | ❌ NOT RUN | Missing `requiem` executable |
| security_gauntlet | ❌ NOT RUN | Missing `requiem` executable |
| recovery_harness | ❌ NOT RUN | Missing `requiem` executable |
| memory_harness | ❌ NOT RUN | Missing `requiem` executable |
| protocol_harness | ❌ NOT RUN | Missing `requiem` executable |
| chaos_harness | ❌ NOT RUN | Missing `requiem` executable |

### ❌ FAIL: `pnpm run verify:contracts`

```
> npx tsx scripts/verify-cli-contract.ts
```

**Error**: All 40 CLI commands fail with `ERR_MODULE_NOT_FOUND: Cannot find module 'packages/cli/dist/commands/decide'`

**Root Cause**: The CLI `dist/` folder is stale (last built Feb 27). The source has 50+ command files but dist only has 4 (agent, ai, decide, junctions).

### ❌ FAIL: `pnpm run verify:determinism`

```
> npx tsx scripts/verify_determinism.ts
```

**Error**: `ERR_MODULE_NOT_FOUND: Cannot find module 'scripts/verify_determinism.ts'`

**Root Cause**: Missing script file.

### ✅ PASS: `pnpm run verify:boundaries`

```
> node scripts/verify-ui-boundaries.mjs
✓ All checks passed!
```

---

## 0.3 TOP FAILURES GROUPED BY ROOT CAUSE

### 1. C++ TEST FAILURES (BLOCKER)

| Category | Issue | File | Fix Required |
|----------|-------|------|--------------|
| Correctness | CAS compact test fails | `tests/cas_test.cpp` or similar | Fix compact index count logic |

### 2. STALE CLI BUILD (BLOCKER)

| Category | Issue | File | Fix Required |
|----------|-------|------|--------------|
| Build | CLI dist/ is stale - missing 46 commands | `packages/cli/dist/` | Rebuild CLI: `pnpm --filter @requiem/cli build` |
| Build | CTest config wrong - looks in wrong path | `build/CTestTestfile.cmake` | Fix test executable path |

### 3. MISSING SCRIPTS (HIGH)

| Category | Issue | File | Fix Required |
|----------|-------|------|--------------|
| Dev Ergonomics | verify_determinism.ts missing | `scripts/` | Create or restore script |

### 4. CTEST CONFIGURATION (MEDIUM)

| Category | Issue | File | Fix Required |
|----------|-------|------|--------------|
| Test Config | 8 tests need Release executable | `build/CTestTestfile.cmake` | Fix paths or rebuild |

---

## SUMMARY

| Metric | Value |
|--------|-------|
| Commands Run | 6 |
| Passed | 3 |
| Failed | 2 |
| Partially Passed | 1 |
| BLOCKER Issues | 2 |
| HIGH Issues | 1 |
| MED Issues | 1 |

---

## VERIFICATION COMMANDS

Exact commands that were run:

```bash
# Lint
cd c:/Users/scott/GitHub/Requiem && pnpm run lint

# Typecheck  
cd c:/Users/scott/GitHub/Requiem && pnpm run typecheck

# C++ Tests
cd c:/Users/scott/GitHub/Requiem/build/Release && requiem_tests.exe
cd c:/Users/scott/GitHub/Requiem/build/Release && kernel_tests.exe
cd c:/Users/scott/GitHub/Requiem/build/Release && context_paging_test.exe

# Contract Verification
cd c:/Users/scott/GitHub/Requiem && pnpm run verify:contracts

# UI Boundaries
cd c:/Users/scott/GitHub/Requiem && pnpm run verify:boundaries

# Determinism (fails - missing script)
cd c:/Users/scott/GitHub/Requiem && pnpm run verify:determinism
```
