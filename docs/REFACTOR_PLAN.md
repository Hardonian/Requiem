# REFACTOR PLAN

**Date**: 2026-03-02
**Repository**: Requiem (c:/Users/scott/GitHub/Requiem)

---

## PHASE 3: IMPLEMENT FIXES

### Order of Changes (Risk-Sorted)

#### 3.1 Fix CAS Compact Test (BLOCKER)

**Rationale**: This is a correctness bug in core functionality. The compact() function incorrectly reloads the index from disk.

**Files to Change**:

- `src/cas.cpp` lines 486-513

**Change**: Remove the `load_index()` call at line 487-488. The compact function should use the in-memory index directly since `remove()` already updated it.

```cpp
// BEFORE (buggy):
void CasStore::compact() {
  if (!index_loaded_)
    load_index();  // <-- This reloads stale data from disk!
  std::lock_guard<std::mutex> lk(index_mu_);
  // ... writes all entries including removed ones
}

// AFTER (fixed):
void CasStore::compact() {
  // Ensure index is loaded but don't reload if already in memory
  if (!index_loaded_) {
    load_index();
  }
  // Now index_ contains only valid entries (remove() already erased invalid ones)
  std::lock_guard<std::mutex> lk(index_mu_);
  // ... writes only valid entries
}
```

**Risk**: Low - this is a straightforward logic fix.

**Test Strategy**: Run `requiem_tests.exe` before and after to verify CAS compact passes.

---

#### 3.2 Rebuild CLI Package (BLOCKER)

**Rationale**: The CLI dist is stale - 46 commands are missing. This breaks all CLI verification.

**Files to Change**: None - just run the build command.

**Change**:

```bash
cd c:/Users/scott/GitHub/Requiem
pnpm --filter @requiem/cli build
```

**Risk**: Medium - need to ensure build succeeds and no new errors introduced.

**Test Strategy**: Run `pnpm run verify:contracts` after build.

---

#### 3.3 Restore/Create verify_determinism.ts (HIGH)

**Rationale**: The script is missing, breaking the verify:determinism command.

**Files to Change**: Create `scripts/verify_determinism.ts`

**Change**: Check git history for original content, or create minimal stub that runs the C++ determinism tests.

**Risk**: Low - just recreating a missing file.

---

### Compatibility Contracts (Must Not Break)

| Contract          | Location                             | Protection                       |
| ----------------- | ------------------------------------ | -------------------------------- |
| CLI command flags | `packages/cli/src/cli.ts`            | Snapshot test exists             |
| API route schemas | `ready-layer/src/app/api/*/route.ts` | Typed responses                  |
| C++ API surface   | `include/requiem/*.hpp`              | Header-only                      |
| Exit codes        | Various                              | Test in `verify-cli-contract.ts` |

---

### Test Strategy

| Before Fix                                         | After Fix                                      |
| -------------------------------------------------- | ---------------------------------------------- |
| Run `requiem_tests.exe` - CAS compact fails        | Run `requiem_tests.exe` - CAS compact passes   |
| Run `pnpm run verify:contracts` - 40 failures      | Run `pnpm run verify:contracts` - all pass     |
| Run `pnpm run verify:determinism` - script missing | Run `pnpm run verify:determinism` - runs tests |

---

### Rollback Strategy

1. **CAS Fix**: Revert `src/cas.cpp` - the bug is well-understood
2. **CLI Rebuild**: Just re-run build if issues - no source changes
3. **Script Restore**: Recreate from git if needed

---

## PHASE 4: QA HARDENING

After Phase 3 fixes, add:

### 4.1 Test Coverage Expansion

- Unit tests for CAS compact (currently integrated in requiem_tests)
- Integration tests for CLI commands (currently smoke tests only)

### 4.2 Regression Detection

- Ensure `pnpm run verify:contracts` is in CI
- Ensure C++ tests run in CI

---

## PHASE 5: DOCS + READMEs

Update after fixes verified:

1. **README.md** - Ensure verify commands match reality
2. **docs/KERNEL_SPEC.md** - Verify claims match code
3. **CLI docs** - Auto-generated from --help

---

## EXECUTION SEQUENCE

```
1. Fix CAS compact in src/cas.cpp
2. Rebuild CLI: pnpm --filter @requiem/cli build
3. Create/restore verify_determinism.ts
4. Run: ctest -C Release --output-on-failure
5. Run: pnpm run verify:contracts
6. Run: pnpm run verify:determinism (if script exists)
7. Update BASELINE_AUDIT.md with results
8. Create FINAL_QA_SUMMARY.md
```
