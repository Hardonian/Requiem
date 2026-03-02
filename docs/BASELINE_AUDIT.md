# BASELINE AUDIT
**Date**: 2026-03-02
**Context**: Pre-refactor production hardening audit (Phase 0).

## 1. Inventory & Architecture Overview

*   **Native Engine (Core OS)**: `src/` contains a custom C++20 engine implementing Content-Addressable Storage (CAS), event logs, state snapshots, and isolated sandboxing (`sandbox_posix.cpp`, `sandbox_win.cpp`).
*   **Web Console / Horizon**: `ready-layer/` is a Next.js 14 App Router application serving as the UI.
*   **TypeScript Packages**: `packages/ai`, `packages/cli`, `packages/ui` for intermediate tooling, AI integrations, and UI components.
*   **CLI Harness**: The `requiem` executable bundles sub-commands like `stress`, `shadow`, `billing`, `security`, etc. for robust production load testing.

## 2. Baseline Test Execution

We executed standard verify and build commands from the root repository:

### Command: `pnpm install`
*   **Result**: [32mPass[0m
*   **Log**: Dependency graph resolved and installed cleanly in 24 seconds.

### Command: `npm run lint` & `npm run typecheck`
*   **Result**: [32mPass[0m
*   **Log**: Both `ready-layer` UI code and internal `packages/` typechecked correctly.

### Command: `npm run build:cpp`
*   **Result**: [32mPass[0m
*   **Log**: CMake configuration and compilation succeeded cleanly (Windows SDK 10.0.26100.0, -O3 Release optimizations applied).

### Command: `ctest --test-dir build -C Release --output-on-failure`
*   **Result**: [31mFail (18% Passed)[0m
*   **Outputs**:
    1.  `requiem_tests`: Failed at `[Phase 6] CAS Scale Readiness`. Error: `CAS compact...FAIL: index should have 2 lines after compact`.
    2.  `stress_harness`, `shadow_runner`, etc. (Tests #4 - #11): Failed to run due to missing executable `requiem`, looking in `requiem.exe` and `Release/requiem.exe`. CMake is mapping them via `COMMAND requiem` instead of `COMMAND $<TARGET_FILE:requiem_cli>`.

### Command: `bash scripts/doctor.sh`
*   **Result**: [31mBlocked (on Windows natively)[0m
*   **Note**: WSL bash `execvpe` failed. Some bash scripts cannot run in pure Windows environment without WSL bridging setup.

## 3. Analysis of Failures (Root Causes)

1.  **CTest Configuration Bug (Missing Target Translation)**
    *   **Symptom**: `Could not find executable requiem`.
    *   **Root Cause**: `CMakeLists.txt` maps tests using `COMMAND requiem stress` instead of generator expression `COMMAND $<TARGET_FILE:requiem_cli>`. On Multi-config generators like MSVC, the path needs generator resolution.
2.  **CAS Compaction Logical Failure**
    *   **Symptom**: `CAS compact...FAIL: index should have 2 lines after compact`.
    *   **Root Cause**: Invariant violation in `cas.cpp` compaction logic, missing cleanup or incorrectly counting deleted blobs.

## 4. Next Steps
Move to Phase 1 (Massive Audit) to comb through the source code and identify architecture violations, performance issues, and correctness bugs.
