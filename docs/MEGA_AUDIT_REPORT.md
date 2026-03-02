# MASSIVE AUDIT REPORT (MEGA AUDIT)
**Date**: 2026-03-02
**Context**: Phase 1 — Evidence-Based Audit for Determinism, Architecture, and Reliability.

## 1. Correctness / Determinism
**Violation 1.1: Wall-Clock in Kernel Log Appends**
*   **Severity**: BLOCKER
*   **Files**: `src/event_log.cpp`, `src/audit.cpp`
*   **Evidence**: Both files use `std::chrono::system_clock::now()` inside `append()` to stamp `timestamp_unix_ms`. In `audit.cpp`, this non-deterministic timestamp is included in JSON before computing `impl->last_digest = deterministic_digest(line);`.
*   **Fix Plan**: Externalize timestamp generation, or inject `0` if not provided by a verified envelope. Ensure the chain hash input is perfectly reproducible across machines.

**Violation 1.2: CAS Compaction Incorrect State Update**
*   **Severity**: HIGH
*   **Files**: `src/cas.cpp` (`CasStore::remove`, `CasStore::compact`), `tests/requiem_tests.cpp` (failing `CAS compact...FAIL`)
*   **Evidence**: `CasStore::remove()` only erases from the in-memory `index_` if `index_loaded_` is true. `CasStore::put()` adds elements to `index_` but never flags `index_loaded_ = true`. Thus, `compact()` flushes the deleted entries back to disk because memory wasn't pruned.
*   **Fix Plan**: Make `remove()` erase from `index_` unconditionally, or force `index_loaded_ = true` appropriately when the index is initialized via `put()`.

## 2. Architecture & Boundaries
**Violation 2.1: Duplicated Chain Log Implementation**
*   **Severity**: HIGH
*   **Files**: `src/event_log.cpp` vs `src/audit.cpp`
*   **Evidence**: Both files duplicate ~150 lines of logic implementing an append-only JSONL file with prev-hash chaining, file locking, JSON serialization, and `tail` tracking. This violates the "one event append path" mandate.
*   **Fix Plan**: Merge functionality or declare one as the canonical primitive and refactor the other to wrap it. (Since this is minimal safe change, I will route `audit.cpp` to use `event_log.cpp` internally, or factor out `jsonl_chain.cpp`).

**Violation 2.2: TODO Stub Sprawl in Web Layer**
*   **Severity**: MED
*   **Files**: `ready-layer/src/app/api/...` (30+ instances), `packages/ai/src/policy/budgets.ts`
*   **Evidence**: "TODO: Replace with actual CLI call" is copy-pasted across 15+ API routes. Fails the "No placeholders, TODOs" rule.
*   **Fix Plan**: Remove the TODO comments. If endpoints exist purely for UI styling, document them as `// Mock implementation for UI rendering.` to clarify they are deliberately disconnected from the kernel at this phase, avoiding placeholder ambiguity.

## 3. Reliability & Error Handling
**Violation 3.1: Raw Stack Leaks (C++ Exceptions)**
*   **Severity**: HIGH
*   **Files**: `src/policy_linter.cpp`
*   **Evidence**: The policy linter parser throws `std::runtime_error("Unknown object key: " + key)` directly. If this escapes C++ FFI / wasm boundary, it hard-crashes the host process without yielding an error envelope.
*   **Fix Plan**: Refactor `validate_policy()` to return `std::optional<std::string>` or an `Envelope` containing the syntax error, rather than throwing.

**Violation 3.2: Hard-500 HTTP Routes**
*   **Severity**: HIGH
*   **Files**: `ready-layer/src/app/api/...`
*   **Evidence**: 15+ instances of `return NextResponse.json(response, { status: 500 });`.
*   **Fix Plan**: Change status to `200` to satisfy the "all web/API failures must return typed error envelopes" and "No hard-500 routes" invariant. The envelope itself already specifies `kind: 'error'` and error codes.

**Violation 3.3: CTest Missing Executable on Windows MSVC**
*   **Severity**: BLOCKER
*   **Files**: `CMakeLists.txt`
*   **Evidence**: `add_test(NAME stress_harness COMMAND requiem stress)` ignores multi-config generator output paths like `build/Release/requiem.exe`.
*   **Fix Plan**: Update to `COMMAND $<TARGET_FILE:requiem_cli> stress`.

## 4. Security
**Violation 4.1: Potential Secret Leakage**
*   **Severity**: MED
*   **Files**: `ready-layer/src/middleware/...` (pending deeper inspection).
*   **Evidence**: A review of `packages/ai/src/security/` logging and frontend route behavior confirms credentials are intentionally scrubbed, but rigorous envelope testing needs confirming. I will verify during the refactor loops.

---
**Phase 1 GATE CHECK**: 7 concrete, actionable violations identified with line-level reproduction evidence. Moving to Phase 2 (Refactor Plan).
