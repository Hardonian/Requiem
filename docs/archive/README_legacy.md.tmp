# Requiem (rqr) — Deterministic Native Runtime v1.3

Requiem is a native C++ runtime for deterministic command execution, content-addressable storage, replay validation, and benchmark harnessing. Now with production ops, hard sandboxing, and ecosystem integration.

## Features

- **Deterministic Execution**: Cryptographically reproducible command execution with BLAKE3 hashing
- **Vendored BLAKE3**: No external crypto dependencies — official BLAKE3 C implementation included
- **Fail-Closed Security**: Errors on missing crypto rather than silently falling back
- **Content-Addressable Storage**: CAS with zstd compression, atomic writes, and integrity verification
- **Sandboxing**: Cross-platform process isolation with truthful capability reporting
- **Proof Bundles**: Verifiable execution artifacts with Merkle roots for audit
- **Replay Validation**: Verify execution results match recorded traces
- **Drift Detection**: Detect non-determinism across benchmark runs
- **Engine Selection**: Dual-run mode for A/B testing and gradual cutover
- **Enterprise Ready**: Multi-tenant support, audit logging, signed results, metrics export

## Version History

- **v1.3**: Ecosystem + Reach/ReadyLayer cutover (dual-run, engine selection, performance gates)
- **v1.2**: Hard sandbox + proof objects (capability truth, Merkle proofs, determinism confidence)
- **v1.1**: Production ops (metrics, config validation, crash-safe CAS, atomic writes)
- **v1.0**: Production lock + replacement certification (vendored BLAKE3, fail-closed security)

## Build

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
```

### Requirements

- CMake 3.20+
- C++20 compiler (GCC 11+, Clang 14+, MSVC 2022+)
- OpenSSL (for TLS/ancillary crypto only)
- zstd (optional, for compression)

## CLI Commands

### Core Commands

```bash
# Execute a command deterministically
requiem exec run --request <json> --out <json>

# Execute with engine selection (v1.3)
requiem exec run --request <json> --out <json> --engine requiem|rust|dual

# Replay and validate a previous execution
requiem exec replay --request <json> --result <json> --cas <dir>

# Verify result digest
requiem digest verify --result <json>

# Compute BLAKE3 hash of a file
requiem digest file --file <path>
```

### CAS Commands

```bash
# Store data in CAS (atomic writes v1.1)
requiem cas put --in <file> --cas <dir> [--compress zstd]

# Get CAS object info
requiem cas info --hash <digest> --cas <dir>

# Verify CAS integrity with sampling (v1.1)
requiem cas verify --cas <dir> [--all|--sample N]

# CAS statistics (v1.1)
requiem cas stats --cas <dir> --top 10

# Garbage collection (dry-run or execute)
requiem cas gc --cas <dir> [--execute]
```

### Health & Diagnostics

```bash
# Health introspection with capabilities
requiem health
# Output: {"hash_primitive":"blake3","sandbox_capabilities":{"enforced":[...],"unsupported":[...]},...}

# Doctor (comprehensive health check)
requiem doctor
# Exits 0 if healthy, 2 if blockers found

# Validate replacement readiness
requiem validate-replacement
# Exits 0 if ready to replace Rust engine, 2 if blockers found

# Metrics export (v1.1)
requiem metrics --format json|prom

# Config validation (v1.1)
requiem config validate --file <path>
```

### Proof Bundles (v1.2)

```bash
# Generate proof bundle for audit
requiem proof generate --request <json> --result <json> --out <json>

# Verify proof bundle integrity
requiem proof verify --bundle <file>
```

### Benchmarking

```bash
# Run benchmark
requiem bench run --spec <json> --out <json>

# Compare benchmarks
requiem bench compare --baseline <json> --current <json> --out <json>

# Performance regression gate (v1.3)
requiem bench gate --baseline <json> --current <json> [--threshold 10.0]
# Exits 2 if regression detected

# Analyze drift
requiem drift analyze --bench <json> --out <json>
requiem drift pretty --in <json>
```

### Policy & LLM

```bash
# Explain execution policy
requiem policy explain

# Check request against policy
requiem policy check --request <json>

# LLM workflow modes
requiem llm explain
```

## Configuration

### Config Schema Version (v1.1)

```json
{
  "config_version": "1.1",
  "hash": {
    "primitive": "blake3",
    "backend": "vendored"
  },
  "cas": {
    "version": "v2",
    "compression": "identity"
  },
  "sandbox": {
    "deny_network": false,
    "max_memory_bytes": 1073741824
  }
}
```

Validate configuration:
```bash
requiem config validate --file config.json
```

### Fail-Closed Behavior (Default)

If BLAKE3 is unavailable (should not happen with vendored implementation):

```bash
# Default: fails with hash_unavailable_blake3 error
requiem exec run --request req.json --out result.json

# With explicit fallback (not recommended for production)
requiem --allow-hash-fallback exec run --request req.json --out result.json
```

### Execution Policy

```json
{
  "command": "/bin/sh",
  "argv": ["-c", "echo hello"],
  "workspace_root": "/tmp/workspace",
  "policy": {
    "mode": "strict",
    "scheduler_mode": "turbo",
    "deterministic": true,
    "deny_network": true,
    "max_memory_bytes": 1073741824,
    "env_allowlist": ["PATH"],
    "env_denylist": ["RANDOM", "TZ"]
  },
  "timeout_ms": 5000,
  "max_output_bytes": 4096
}
```

### Scheduler Modes

- `repro`: Strict FIFO, single-worker, deterministic dispatch
- `turbo`: Worker pool for performance (default)

### Determinism Confidence (v1.2)

Execution results include confidence level:

```json
{
  "determinism_confidence": {
    "level": "high",
    "score": 1.0,
    "reasons": []
  }
}
```

Levels:
- `high`: No stochastic components, full sandbox enforcement
- `medium`: Some non-deterministic factors controlled
- `best_effort`: Stochastic components present (LLM, partial sandbox)

## Proof Bundles (v1.2)

Proof bundles provide verifiable artifacts of execution:

```json
{
  "merkle_root": "abc123...",
  "input_digests": ["request_digest", "input1_digest"],
  "output_digests": ["stdout_digest", "stderr_digest", "output_file_digest"],
  "policy_digest": "policy_hash",
  "replay_transcript_digest": "trace_hash",
  "signature_stub": "",
  "engine_version": "1.2",
  "contract_version": "1.1"
}
```

Use cases:
- Audit trails for compliance
- Third-party verification
- Dispute resolution
- Chain of custody

## Engine Selection (v1.3)

For gradual cutover from Rust engine:

```bash
# Use Requiem engine (default)
requiem exec run --request req.json --out result.json --engine requiem

# Dual-run mode for comparison
requiem exec run --request req.json --out result.json --engine dual
```

Dual-run mode:
- Executes with both engines
- Compares results
- Emits diff report if mismatch
- Does not fail on mismatch (for sampling)

## Metrics (v1.1)

JSON format:
```bash
requiem metrics --format json
```

Prometheus format:
```bash
requiem metrics --format prom
```

Example Prometheus output:
```
# HELP requiem_exec_total Total executions
# TYPE requiem_exec_total counter
requiem_exec_total 1000

# HELP requiem_cas_hit_rate CAS cache hit rate
# TYPE requiem_cas_hit_rate gauge
requiem_cas_hit_rate 0.95
```

## Sandbox Capabilities

Requiem truthfully reports sandbox capabilities:

```bash
requiem health
```

Output:
```json
{
  "sandbox_capabilities": {
    "enforced": ["workspace_confinement", "rlimits", "job_objects"],
    "unsupported": ["seccomp_bpf", "network_isolation"],
    "partial": []
  }
}
```

Linux:
- ✅ rlimits (CPU, memory, FDs)
- ✅ Process groups
- ⚠️ seccomp-bpf (infrastructure present, not fully enforced)
- ⚠️ network namespaces (requested but not falsely claimed)

Windows:
- ✅ Job Objects
- ✅ Process mitigations
- ✅ Restricted tokens
- ⚠️ Network isolation (AppContainer not implemented)

## Performance Gates (v1.3)

CI integration for performance regression detection:

```bash
requiem bench gate --baseline baseline.json --current current.json --threshold 10.0
```

- Exit 0: No regression (within threshold)
- Exit 2: Regression detected

## Hashing

Requiem uses BLAKE3 for all cryptographic hashing:

- **Empty string**: `af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262`
- **"hello"**: `ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f`

Domain-separated hashing:
- Requests: `hash_domain("req:", canonical_json)`
- Results: `hash_domain("res:", canonical_json)`
- CAS: `hash_domain("cas:", raw_bytes)`

## Project Structure

```
requiem/
├── include/requiem/    # Public headers
│   ├── hash.hpp       # BLAKE3 hashing API
│   ├── cas.hpp        # Content-addressable storage
│   ├── runtime.hpp    # Execution engine
│   ├── types.hpp      # Core data structures
│   ├── sandbox.hpp    # Process sandboxing
│   ├── replay.hpp     # Replay validation
│   └── jsonlite.hpp   # JSON utilities
├── src/               # Implementation
├── tests/             # Test suite
├── third_party/       # Vendored dependencies
│   └── blake3/        # BLAKE3 C implementation
├── docs/              # Documentation
└── scripts/           # Verification scripts
```

## Verification Scripts

```bash
./scripts/verify.sh           # Build verification
./scripts/verify_contract.sh  # Contract tests
./scripts/verify_smoke.sh     # Smoke tests
./scripts/verify_bench.sh     # Benchmark tests
./scripts/verify_drift.sh     # Drift detection
./scripts/verify_lint.sh      # Lint checks
```

## Cutover Readiness

For replacing the Rust engine:

```bash
# Validate readiness
requiem validate-replacement

# Expected output:
# {"ok":true,"blockers":[],"hash_primitive":"blake3","hash_backend":"vendored"}
```

Recommended rollout:
1. Deploy v1.1 (Production Ops) - monitoring, crash safety
2. Deploy v1.2 (Hard Sandbox) - proof bundles, capability truth
3. Deploy v1.3 (Cutover) - dual-run sampling, gradual switch

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [CONTRACT.md](docs/CONTRACT.md) - API contracts
- [SECURITY.md](docs/SECURITY.md) - Security considerations
- [BENCH.md](docs/BENCH.md) - Benchmarking guide
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Implementation details

## License

MIT License - See [LICENSE](LICENSE)

BLAKE3 is licensed under CC0 (public domain) - See [third_party/blake3/LICENSE](third_party/blake3/LICENSE)
