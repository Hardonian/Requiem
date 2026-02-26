# Reality Check Fixes - Requiem v1.0

This document lists all fixes made during the post-implementation reality check.

## Critical Fixes

### 1. JSON Parser - Double/Number Support (CRITICAL)
**Issue**: The JSON parser only supported unsigned 64-bit integers. It failed on:
- Negative numbers
- Floating point numbers
- Scientific notation

**Fix**: Rewrote `src/jsonlite.cpp` to:
- Parse negative integers as double
- Parse floating point numbers with fractional parts
- Parse scientific notation (e.g., `1.5e10`)
- Format doubles deterministically with 6 decimal places in canonicalization
- Add proper escape sequence handling (`\t`, `\r`, `\b`, `\f`)

**Added**:
- `get_double()` function in header and implementation
- Double type in Value variant
- Format helper for consistent double serialization

### 2. Sandbox Applied Reporting (CRITICAL)
**Issue**: `sandbox_applied` field in ExecutionResult was never populated. The runtime claimed sandbox enforcement but didn't report what was actually enforced.

**Fix**: 
- Updated `ProcessResult` struct to include sandbox capability fields
- Modified `sandbox_posix.cpp` and `sandbox_win.cpp` to report actual capabilities
- Added `detect_platform_sandbox_capabilities()` function for each platform
- Updated `runtime.cpp` to populate `sandbox_applied` from process result
- Added enforced/unsupported lists to sandbox_applied

### 3. Policy Parsing (CRITICAL)
**Issue**: Nested policy objects in JSON requests were not being parsed. The TODO comment showed this was incomplete.

**Fix**:
- Updated `parse_request_json()` to properly parse nested `policy` object
- Parse nested `llm` object
- Extract fields: `mode`, `scheduler_mode`, `time_mode`, `deterministic`, `allow_outside_workspace`
- Fall back to top-level fields for backward compatibility

### 4. JSON Value Type Exposure (CRITICAL)
**Issue**: The `Value` struct was in an anonymous namespace in jsonlite.cpp, making it impossible to use `std::get<Object>()` in runtime.cpp for nested object access.

**Fix**:
- Moved `Value` struct definition to `include/requiem/jsonlite.hpp`
- Exposed `Object` and `Array` type aliases in header
- Removed duplicate definitions from cpp file

## Test Additions

### 5. Determinism Repeat Test
**Added**: `test_determinism_repeat()` in `tests/requiem_tests.cpp`
- Runs same request N=20 times
- Verifies identical `result_digest` across all runs
- Verifies identical `stdout_digest` across all runs

### 6. CAS Corruption Detection Test
**Added**: `test_cas_corruption_detection()` in `tests/requiem_tests.cpp`
- Stores data in CAS
- Corrupts stored file by flipping bits
- Verifies `cas.get()` returns `nullopt` (detects corruption)

### 7. JSON Double Parsing Test
**Added**: `test_json_double_parsing()` in `tests/requiem_tests.cpp`
- Tests double value extraction
- Tests negative number handling
- Tests scientific notation
- Tests canonicalization format

## Documentation Updates

### 8. CONTRACT.md Updates
- Added `sandbox_applied` schema to ExecutionResult
- Added `sandbox_applied` example to result JSON
- Updated canonicalization documentation to reflect:
  - 6 decimal place formatting for floats
  - Scientific notation support
  - Negative number support
  - Complete escape sequence list
- Added "JSON Limitations" section

## Script Updates

### 9. Bench Spec Format Fix
**Fixed**: `docs/examples/bench_spec.json`
- Removed nested "request" object (CLI expects flat structure)
- Moved request fields to top level alongside "runs"

### 10. Secrets Verification Script
**Added**: `scripts/verify_secrets.sh` and `scripts/verify_secrets.ps1`
- Scans for patterns like `password=`, `secret=`, `token=`, `api_key=`
- Checks for Authorization headers
- Checks for AWS credential patterns
- Integrated into CI workflow

## Files Modified

| File | Changes |
|------|---------|
| `include/requiem/jsonlite.hpp` | Exposed Value struct, added get_double, added Array alias |
| `src/jsonlite.cpp` | Complete rewrite of number parsing, added double support, added iomanip include |
| `include/requiem/sandbox.hpp` | Added sandbox capability fields to ProcessResult, added detect_platform_sandbox_capabilities() |
| `src/sandbox_posix.cpp` | Populate sandbox fields, added capability detection |
| `src/sandbox_win.cpp` | Populate sandbox fields, added capability detection |
| `src/runtime.cpp` | Populate sandbox_applied, fix policy/llm nested parsing, add result JSON fields |
| `tests/requiem_tests.cpp` | Added 3 new test functions |
| `docs/CONTRACT.md` | Updated schema, added sandbox_applied, updated canonicalization docs |
| `docs/examples/bench_spec.json` | Fixed format (removed nested request object) |
| `.github/workflows/ci.yml` | Added secrets scan step |
| `scripts/verify_secrets.sh` | New file |
| `scripts/verify_secrets.ps1` | New file |

## Verification Status

| Check | Status | Notes |
|-------|--------|-------|
| Hash primitive = "blake3" | ✅ | Verified in code |
| Hash backend = "vendored" | ✅ | Verified in code |
| Fail-closed default | ✅ | No fallback without explicit flag |
| validate-replacement gate | ✅ | Fails on fallback/unavailable |
| JSON canonicalization | ✅ | Fixed double/negative support |
| Sandbox reporting | ✅ | Now populated correctly |
| Policy parsing | ✅ | Nested objects now parsed |
| Determinism test | ✅ | N=20 repeat test added |
| CAS corruption test | ✅ | Bit-flip detection added |
| Secrets scan | ✅ | Scripts added |
| Cross-platform parity | ⚠️ | Code ready, needs CI verification |

## Remaining Work (Future)

1. **Seccomp implementation**: Currently marked as unsupported
2. **Windows restricted tokens**: Currently marked as unsupported
3. **Full LLM freeze flow**: Stub exists, needs provider integration
4. **Plugin ABI implementation**: Structures defined, loading not implemented
5. **mmap for CAS**: Code uses streams, mmap optimization not implemented

## GREEN Checklist Commands

```bash
# Build and test
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure

# Verification scripts
./scripts/verify.sh
./scripts/verify_smoke.sh
./scripts/verify_bench.sh
./scripts/verify_drift.sh
./scripts/verify_hash_backend.sh
./scripts/verify_secrets.sh
./scripts/verify_contract.sh
./scripts/verify_lint.sh

# Gate check
./build/requiem_cli validate-replacement
```

## Determinism Guarantee

After these fixes:
- Identical request + identical artifacts + identical policy → identical result_digest ✅
- Cross-platform digest parity depends on command behavior (PATH, cwd handling)
- JSON canonicalization is deterministic for all supported types
- BLAKE3 hashing is deterministic across platforms
