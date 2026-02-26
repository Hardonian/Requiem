# Changelog

## v1.0 (Production Lock + Replacement Certification)

### Added
- **BLAKE3 Vendored Implementation**: Official BLAKE3 C implementation vendored from BLAKE3-team/BLAKE3
  - Added to `third_party/blake3/` with all source files
  - CMake integration for cross-platform builds
  - CPU feature detection (SSE2, SSE4.1, AVX2, AVX-512)
  - Portable fallback for all platforms
- **Fail-Closed Security**: Default behavior returns error when BLAKE3 is unavailable
  - `hash_unavailable_blake3` error code for missing crypto
  - Explicit `--allow-hash-fallback` CLI flag required for fallback mode
  - `compat_warning` flag when fallback is enabled
- **Domain-Separated Hashing**: Context-specific hash functions for different use cases
  - `hash_domain(prefix, data)` - Generic domain separation
  - `canonical_json_hash(json)` - For request canonicalization (prefix: "req:")
  - `result_json_hash(json)` - For result canonicalization (prefix: "res:")
  - `cas_content_hash(bytes)` - For CAS content (prefix: "cas:")
- **Health Introspection**: `requiem health` now reports full metadata
  - `hash_primitive`, `hash_backend`, `hash_version`
  - `hash_available`, `compat_warning`
  - `cas_version`, `compression_capabilities`
- **Doctor Utility**: `requiem doctor` runs comprehensive health checks
  - Hash primitive verification (must be blake3)
  - Hash vector verification (known test vectors)
  - Blocker detection for replacement readiness
- **Validate-Replacement Hard Gate**: `requiem validate-replacement` enforces:
  - `hash_primitive == "blake3"`
  - `hash_backend != "fallback"`
  - `hash_backend != "unavailable"`
  - `compat_warning == false`
  - Hash vectors must pass
- **Comprehensive Test Suite**: BLAKE3 known vector tests
  - Empty string: `af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262`
  - "hello": `ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f`
  - 1MB deterministic data with consistency checks
- **Benchmark Enhancements**: 
  - Full statistics: min, max, mean, stddev
  - Quantiles: p50, p90, p95, p99
  - Drift detection count
  - `bench compare` for regression testing
- **Drift Analyzer**: `drift analyze` detects mismatches across benchmark runs
- **CAS Integrity Verification**: `cas verify` validates stored objects
- **File Hashing**: `digest file --file <path>` computes BLAKE3 hash of file

### Changed
- Removed dependency on LLVM BLAKE3 (now fully vendored)
- Simplified CMake configuration with `REQUIEM_BLAKE3_VENDORED` always enabled
- Updated all hash operations to use domain-separated BLAKE3

### Security
- Determinism correctness prioritized over performance
- No silent crypto substitution allowed
- Cross-platform parity enforced (Linux + Windows)

## v0.9 (Enterprise Governance + Zero Trust + Migration Safety)

### Added
- Multi-tenant isolation with `tenant_id` support
- Sandbox capabilities detection (`detect_sandbox_capabilities()`)
- Sandbox applied reporting in execution results
- Config layer foundation (`requiem config show`)
- Cluster verify command (`requiem cluster verify`)

### Changed
- Enhanced `ExecutionResult` with `SandboxApplied` field
- Enhanced `ExecutionRequest` with tenant and sandbox options

## v0.8 (Cluster + Drift + Bench - Decision-Grade Quants)

### Added
- Drift analyzer with structured mismatch reports
- Benchmark quantiles (p50/p95/p99)
- Throughput and CAS hit-rate reporting
- Deterministic histogram support (log buckets)
- Drift count tracking in benchmark results

## v0.7 (Authoritative Engine)

### Added
- Hard OS sandboxing baseline detection
- Dual-mode scheduler (`repro`/`turbo`)
- Plugin ABI foundation (C ABI, versioned hooks)
- LLM workflow modes (`freeze_then_compute`)
- `hash_unavailable_blake3` error code

## v0.6

### Added
- Hash runtime contract primitives
- Fallback control API

## v0.5

### Added
- Drift analyzer and drift pretty output
- Benchmark quantiles (p50/p95/p99)
- Control-plane report command
- Structured error code surface

## v0.4

### Added
- Strict JSON validation (duplicate-key rejection)
- Canonical JSON serializer
- CAS v2 compression metadata (identity/zstd)

## v0.3

### Added
- Windows process runner (CreateProcessW + Job Objects)
- POSIX timeout parity with process-group kill
- Determinism policy explain/check CLI

## v0.2

### Added
- Content-addressable storage (CAS)
- Execution replay validation
- Request/result canonicalization

## v0.1

### Added
- Initial deterministic execution engine
- BLAKE3 hashing foundation
- Basic CLI interface
