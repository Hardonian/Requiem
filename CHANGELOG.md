# Changelog

## v1.3 (Ecosystem + Reach/ReadyLayer Cutover)

### Added
- **Reach CLI Cutover Tooling**: Feature-flag-compatible engine selection
  - `--engine=rust|requiem|dual` flag for execution mode
  - Dual-run mode for A/B testing between engines
  - Diff report generation for mismatch analysis
- **ReadyLayer Control Plane Hooks**: Event export and validation
  - JSONL event stream with `engine_version` and `contract_version`
  - Remote replay validation client stub
  - `requiem cluster verify` supports remote result bundles
- **Plugin Ecosystem Hygiene**: Sandboxing and testing
  - Plugin callback timeouts
  - Crash isolation with exception handling
  - `requiem plugin test --path <so/dll>` compatibility harness
- **Performance Regression Protection**: CI gates
  - `requiem bench gate --baseline <file> --current <file>`
  - Configurable regression threshold (default 10%)
  - Pass/fail exit codes for CI integration

### Changed
- Enhanced `cluster verify` with version metadata
- Improved engine selection policy with tenant/workload mappings

## v1.2 (Hard Sandbox + Proof Objects)

### Added
- **Sandbox Enforcement Deepening**: Capability-honest security
  - Linux: seccomp-bpf stub infrastructure (minimal profile)
  - Linux: Network namespace isolation hooks
  - Windows: Process mitigation policies (ASLR, strict handles)
  - Windows: Restricted token support
  - Truthful capability reporting (no lying about enforcement)
- **Proof Artifacts**: Verifiable execution bundles
  - `requiem proof generate --request <file> --result <file> --out <file>`
  - `requiem proof verify --bundle <file>`
  - Merkle root computation from input/output digests
  - Policy digest and replay transcript inclusion
  - Signature stub for external signing
- **Determinism Confidence**: Honest reporting of guarantees
  - `determinism_confidence.level`: high|medium|best_effort
  - Confidence score (0.0-1.0) with reasons
  - Factors: LLM mode, sandbox partial enforcement, capability failures
- **Signed Envelope Readiness**: External signer plugin interface
  - `signature` field in result JSON
  - Signature metadata fields in proof bundle
  - Plugin-based signing (avoids crypto bloat in core)

### Changed
- Enhanced sandbox reporting with `partial` enforcement list
- Process spec includes resource limits and network isolation flags
- Sandbox capabilities expanded: `seccomp_bpf`, `network_isolation`, `process_mitigations`

## v1.1 (Production Ops)

### Added
- **Service Hardening**: Robust request lifecycle
  - Automatic `request_id` generation (deterministic fallback)
  - `start_timestamp` and `end_timestamp` (excluded from digest)
  - `duration_ms` for latency tracking
  - Structured status transitions
- **Crash-Only Safety**: Atomic CAS writes
  - Temp file + rename pattern for atomic object writes
  - Journal metadata with timestamps
  - Automatic cleanup on failure
- **Observability**: Structured metrics
  - `requiem metrics --format json|prom`
  - Counters: exec_total, exec_fail, timeouts, queue_full
  - CAS metrics: bytes_total, objects_total, hit_rate
- **Config Schema Versioning**: Compatibility management
  - `config_version` field (default "1.1")
  - `requiem config validate --file <path>`
  - Unknown field detection with warnings
- **Log Redaction Assurance**: Secret protection
  - Debug logs redact sensitive values
  - Log contract test capability
- **CAS Enhancements**: Operations and integrity
  - `requiem cas stats --top N`: Largest objects report
  - `requiem cas verify --sample N`: Random sampling
  - `requiem cas gc --execute`: Reference-counted GC
  - `put_atomic`: Crash-safe writes
- **Doctor Expansion**: Comprehensive health checks
  - Hash backend verification
  - Sandbox capability truth
  - CAS integrity sampling
  - Serve loop sanity check

### Changed
- Health output includes sandbox capabilities and engine version
- CAS metadata includes `created_at` and `ref_count`
- Enhanced doctor with warnings (non-blocking issues)

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
