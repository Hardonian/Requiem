# REFACTOR PLAN (SAFE, SEQUENCED, MINIMAL)

**Date**: 2026-03-02
**Context**: Re-aligning the repository to the "Determinism First" / Antigravity specs.

## 1. Ordered Refactor Sequence

### Stage A: CLI & Build Tooling Correctness

1. **C++ Build Tests Alignment** (`CMakeLists.txt`): Use `$<TARGET_FILE:requiem_cli>` instead of raw `requiem` binary name in CTest macros, to ensure Windows MSVC runner paths map correctly to `Release\requiem.exe`.
   - *Risk*: Low.
   - *Rationale*: Tests cannot execute without finding the command. Allows true signal on regression.

### Stage B: C++ Kernel Determinism & Correctness

2. **CAS Compact Logic Update** (`src/cas.cpp`): Ensure memory writes un-flag or forcibly erase deleted entries regardless of lazy `index_loaded_` states so that compaction doesn't recover orphaned JSON headers to disk.
   - *Risk*: Medium.
   - *Rationale*: Eliminates a core failure in the `CAS Scale Readiness` test suite.
3. **Remove Wall-Clock Dependency** (`src/audit.cpp`, `src/event_log.cpp`): Instead of hashing `std::chrono::system_clock::now()` inside the kernel log struct generator, pass `0` or an injected logical sequence time exclusively stringified in the payload.
   - *Risk*: High. Modifies the fundamental event hash output structure.
   - *Rationale*: The "No wall-clock inside kernel paths" mandate.
4. **Remove Raw Exceptions** (`src/policy_linter.cpp`): Replace `throw std::runtime_error()` with standard error tracking strings, removing stack leak potential across boundaries.
   - *Risk*: Medium. Modifies linter semantics.
   - *Rationale*: Deterministic sandboxing requires deterministic error envelopes.
5. **Consolidate Event Log & Audit Log**: Determine if `ImmutableAuditLog` can subclass or wrap `EventLog`, rather than duplicating 250 LOC.
   - *Risk*: Medium.
   - *Rationale*: "One event append path" rule.

### Stage C: Web Route Consolidation

6. **Eliminate "Hard-500" & TODO Markers** (`ready-layer/src/app/api/...`): Systematically replace `status: 500` with proper `status: 200` enclosing the `kind: 'error'` typed envelope. Remove `// TODO: Replace with actual CLI call` stubs.
   - *Risk*: Low.
   - *Rationale*: Mocks are valid if they fulfill the typed schema interface for UI prototyping, but fake tests and hard-500s violate the error wrapping rules.

## 2. Compatibility Contracts

- **CLI Inputs/Outputs**: The `requiem` native binary args and JSON payload formats must not break.
- **API Schemas (ready-layer/...)**: `ApiResponse<T>` wrappers must remain strictly aligned with UI expectations. No breaking changes to `Envelope` attributes.
- **Chain Hashes**: The format of the `Events.jsonl` lines must be structurally comparable after the fix (i.e., sequence and prev hash must remain the core hashing roots).

## 3. Test Strategy

- Before addressing the C++ bugs, we will resolve the CMake CTest references to get the baseline red.
- We rely on the existing, heavily-detailed `kernel_tests.cpp` to prove deterministic chain hashes post-fix.
- Run the full set of `verify:*` scripts across the TS ecosystem to prevent regressions.

## 4. Rollback Strategy

- Every group (Stage A, B, C) will be wrapped in isolated git commits: e.g., `fix(cmake): resolve ctest target path`, `fix(cas): enforce correct compaction indices`.
- If any tests fail during the process, standard `git reset --hard` will be applied per commit boundary.
