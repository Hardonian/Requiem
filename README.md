# Requiem (rqr)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#verification)

**Requiem** is a high-performance, native C++ runtime designed for deterministic command execution, content-addressable storage (CAS), and verifiable replay validation. Built for environments where correctness and repeatability are non-negotiable.

## Key Capabilities

- **Deterministic Execution**: Cryptographically reproducible process execution with BLAKE3 hashing.
- **Hard Sandboxing**: Cross-platform process isolation (Linux cgroups/seccomp, Windows Job Objects).
- **Content-Addressable Storage**: Integrity-verified CAS with zstd compression and atomic writes.
- **Proof Bundles**: Verifiable execution artifacts with Merkle roots for audit trails.
- **Drift Detection**: Automated detection of non-determinism across benchmark runs.
- **Engine Diversity**: Native support for dual-run validation and gradual engine migration.

---

## Quickstart

### 1. Build from Source

```bash
# Clone and build the engine
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

### 2. Verify Health

```bash
./build/requiem health
```

### 3. Execute Deterministically

```bash
# Run a command with a request policy
./build/requiem exec run --request request.json --out result.json
```

---

## Configuration

Requiem uses a strict JSON schema for configuration, ensuring that execution policies are portable and auditable.

```json
{
  "command": "/usr/bin/python3",
  "argv": ["script.py"],
  "policy": {
    "deterministic": true,
    "deny_network": true,
    "max_memory_bytes": 1073741824,
    "env_allowlist": ["PATH", "PYTHONHASHSEED"]
  }
}
```

---

## Architecture

Requiem is structured for maximum isolation and minimal overhead.

```text
 ┌─────────────────────────────────────────────────────────┐
 │                      Requiem CLI                        │
 └───────────┬────────────────────────────┬────────────────┘
             │                            │
    ┌────────▼────────┐          ┌────────▼────────┐
    │  Runtime Engine │          │       CAS       │
    │ (Sandboxed Ops) │          │ (Addressable)   │
    └────────┬────────┘          └────────┬────────┘
             │                            │
    ┌────────▼────────┐          ┌────────▼────────┐
    │  Sandbox Layer  │          │   BLAKE3 Hash   │
    │ (OS Primitives) │          │    (Vendored)   │
    └─────────────────┘          └─────────────────┘
```

---

## Repository Layout

- `include/requiem/`: Public C++ headers for engine embedding.
- `src/`: Core implementation of runtime, CAS, and sandboxing.
- `packages/ui/`: React-based design system for operational interfaces.
- `ready-layer/`: Integration layer for deployment workflows.
- `docs/`: In-depth documentation on architecture, security, and contracts.

---

## Verification

Requiem maintains a rigorous verification suite to prevent regressions in determinism or performance.

```bash
# Run full verification suite
npm run verify

# Specific checks
npm run test           # C++ unit tests
npm run verify:ui      # UI typecheck and lint
./scripts/verify_determinism.sh # Determinism audit
```

---

## License & Security

Requiem is released under the [MIT License](LICENSE).

For security considerations and vulnerability reporting, please see [SECURITY.md](SECURITY.md).
Internal implementation details can be found in [docs/internal](docs/internal).
