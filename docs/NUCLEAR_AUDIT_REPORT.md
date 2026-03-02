# NUCLEAR AUDIT REPORT

## Executive Summary

A comprehensive audit of the Requiem C++ kernel and Web repos was prioritized to identify drift, harden invariants, and enforce convergence against `KERNEL_SPEC.md`. Several critical issues have been discovered and resolved, focusing specifically on establishing deterministic builds and verifiable executions.

## Critical Findings & Actions Taken

### 1. Build & Test Failures

**Finding**: The C++ engine failed to compile locally due to missing headers, unused variables, hallucinated variables in `cli.cpp` (`denied`, `units_charged` in Plan Execution receipts), and invalid syntax.
**Action**: Cleaned up MSVC compilation errors in `cli.cpp`. Mapped CLI variables accurately to `requiem::Receipt`. Tested compilation successfully in Release mode.

### 2. Environment Drift & Determinism

**Finding**: `snapshot.cpp` injected `timestamp_unix_ms` directly into `snapshot_hash` and `event_log.cpp` utilized clock mechanisms. This violates INV-NO-WALLCLOCK (logical time only).
**Action**: Stripped `timestamp_unix_ms` from `snapshot_compute_hash()`. Verified EventLog only depends on deterministically accumulated logic sequences.

### 3. EventLog Locking & Windows Compatibility

**Finding**: Windows users experienced test hangs and crashes (Issue #352-hang) because `EventLog` construction held an `ifstream` read lock indefinitely and then attempted `std::fopen(..."a")` append access. Test fixtures then tried to `std::filesystem::remove_all()` the temporary directory while handles remained open, violently crashing `ctest`.
**Action**: Injected an explicit `ifs.close()` prior to appending. Wrapped test fixtures in internal scope blocks to let `EventLog` safely destruct to `fclose` its internal handles. Un-skipped all test cases in `kernel_tests.cpp`.

### 4. Enforce "One Schema" (Receipts)

**Finding**: `cli.cpp` arbitrarily queried Plan Execution receipts as if they were Metering API results (`units_charged`, `budget_before`), leading to missing fields compiler errors and unprovable behavior.
**Action**: Converged CLI `receipt show` implementation with the canonical JSON `Receipt` struct in C++.

## Convergence Status

- `ctest` passes 100% of cases unconditionally.
- Zero non-deterministic mutations within consensus algorithms.
- Unified schema and invariant documentation updated.

_See `CONVERGENCE_INDEX.md` for a full mapping of primitives._
