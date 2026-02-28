# Requiem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#verification)
[![Determinism](https://img.shields.io/badge/determinism-byte--perfect-blueviolet)](#invariants)

**Requiem** is a high-performance, native C++ runtime designed for **deterministic process execution**, content-addressable storage (CAS), and verifiable replay validation.

Built for environments where correctness and repeatability are non-negotiable—from CI/CD pipelines and reproducible builds to secure sandboxed execution.

## Key Capabilities

- **Deterministic Execution**: Cryptographically reproducible process execution with BLAKE3 hashing.
- **Hard Sandboxing**: Cross-platform process isolation using OS primitives (Linux cgroups/seccomp, Windows Job Objects).
- **Content-Addressable Storage**: Integrity-verified CAS with zstd compression and atomic writes.
- **Verifiable Proofs**: Merkle-root based execution artifacts for auditing and supply chain security.
- **Drift Detection**: Automated detection of non-determinism and environmental leakage.

## Architecture

Requiem is designed for maximum isolation and minimal overhead.

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

## Quickstart

### 1. Build from Source

Requires CMake 3.20+, C++20 compiler, and OpenSSL.

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

### 2. Verify Health

```bash
./build/requiem health
```

### 3. Execute Deterministically

Run a command through the engine with a strict execution policy:

```bash
./build/requiem exec run --command "/bin/echo" --argv "Hello, World" --out result.json
```

## Invariants

Requiem maintains strict system invariants to ensure reliability. These are enforced by our CI gates:

- **INV-1: Digest Parity**: Same inputs must produce byte-for-byte identical results.
- **INV-2: CAS Immutability**: Silent mutation of stored objects is prohibited.
- **INV-5: OSS Isolation**: Zero dependency on enterprise-only components.

See [docs/DETERMINISM.md](docs/DETERMINISM.md) for the full list of invariants.

## Documentation

- [Getting Started](docs/GETTING_STARTED.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Security Policy](docs/SECURITY.md)
- [System Invariants](docs/DETERMINISM.md)
- [CAS Specification](docs/CAS.md)

## Verification

Run the full verification suite (requires Node.js for UI checks):

```bash
npm run verify
```

This ensures C++ build integrity, unit test passing, UI boundary safety, and determinism.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## License & Security

Requiem is released under the [MIT License](LICENSE).

For security considerations and vulnerability reporting, please see [SECURITY.md](SECURITY.md).
Internal logs and historical summaries are available in [docs/internal](docs/internal).
