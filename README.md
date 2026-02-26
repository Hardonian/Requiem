# Requiem (rqr) — Deterministic Native Runtime v1.0

Requiem is a native C++ runtime for deterministic command execution, content-addressable storage, replay validation, and benchmark harnessing.

## Features

- **Deterministic Execution**: Cryptographically reproducible command execution with BLAKE3 hashing
- **Vendored BLAKE3**: No external crypto dependencies — official BLAKE3 C implementation included
- **Fail-Closed Security**: Errors on missing crypto rather than silently falling back
- **Content-Addressable Storage**: CAS with zstd compression and integrity verification
- **Sandboxing**: Cross-platform process isolation (Linux + Windows)
- **Replay Validation**: Verify execution results match recorded traces
- **Drift Detection**: Detect non-determinism across benchmark runs
- **Enterprise Ready**: Multi-tenant support, audit logging, signed results

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

# Replay and validate a previous execution
requiem exec replay --request <json> --result <json> --cas <dir>

# Verify result digest
requiem digest verify --result <json>

# Compute BLAKE3 hash of a file
requiem digest file --file <path>
```

### CAS Commands

```bash
# Store data in CAS
requiem cas put --in <file> --cas <dir> [--compress zstd]

# Get CAS object info
requiem cas info --hash <digest> --cas <dir>

# Verify CAS integrity
requiem cas verify --cas <dir>

# Garbage collection (dry-run)
requiem cas gc --cas <dir>
```

### Health & Diagnostics

```bash
# Health introspection
requiem health
# Output: {"hash_primitive":"blake3","hash_backend":"vendored","hash_version":"1.8.3",...}

# Doctor (comprehensive health check)
requiem doctor
# Exits 0 if healthy, 2 if blockers found

# Validate replacement readiness
requiem validate-replacement
# Exits 0 if ready to replace Rust engine, 2 if blockers found
```

### Benchmarking

```bash
# Run benchmark
requiem bench run --spec <json> --out <json>

# Compare benchmarks
requiem bench compare --baseline <json> --current <json> --out <json>

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

## Hashing

Requiem uses BLAKE3 for all cryptographic hashing:

- **Empty string**: `af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262`
- **"hello"**: `ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f`

Domain-separated hashing:
- Requests: `hash_domain("req:", canonical_json)`
- Results: `hash_domain("res:", canonical_json)`
- CAS: `hash_domain("cas:", raw_bytes)`

## Configuration

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
./scripts/verify_lint.sh      # Lint checks
```

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [CONTRACT.md](docs/CONTRACT.md) - API contracts
- [SECURITY.md](docs/SECURITY.md) - Security considerations
- [BENCH.md](docs/BENCH.md) - Benchmarking guide

## License

MIT License - See [LICENSE](LICENSE)

BLAKE3 is licensed under CC0 (public domain) - See [third_party/blake3/LICENSE](third_party/blake3/LICENSE)
