# Requiem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](#verification)
[![Node](https://img.shields.io/badge/node-20.x-green)](#quickstart)

Provable AI Runtime — deterministic execution with cryptographic verification.

## Summary

Requiem provides a deterministic execution environment for AI workloads with:
- **Cryptographic proofs**: BLAKE3 domain-separated hashing for every execution
- **Content-addressed storage**: CAS v2 with dual-hash verification (BLAKE3 + SHA-256)
- **Policy enforcement**: Deny-by-default gates for all tool invocations
- **Replay verification**: Byte-exact replay with divergence detection

## Quickstart

```bash
# Install dependencies
pnpm install

# Build the engine
make build

# Run verification suite
make verify

# Execute with proof
./build/requiem run -- echo "hello"

# Run health check
make doctor
```

## Verification Commands

```bash
# Full verification suite
make verify

# Individual verification targets
make verify:cpp         # C++ engine tests
make verify:web         # Web console tests
make verify:boundaries  # Layer isolation
make verify:integrity   # CAS integrity
make verify:policy      # Policy enforcement
make verify:replay      # Replay exactness

# Quality gates
make lint
make typecheck
make test
```

## Architecture

```
┌─────────────────────────────────────────┐
│  Dashboard (Next.js)                    │
│  Logs · Runs · Policies                 │
├─────────────────────────────────────────┤
│  Control Plane (TypeScript)             │
│  Policy Gate · Tool Registry            │
├─────────────────────────────────────────┤
│  Native Engine (C++)                    │
│  BLAKE3 · CAS v2 · Sandbox · Replay     │
└─────────────────────────────────────────┘
```

## CLI Usage

```bash
# Execute with deterministic output
requiem run -- echo "hello"

# Verify a fingerprint
requiem verify <fingerprint>

# Run stress tests
requiem stress

# Run security gauntlet
requiem security
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Invariant failure |
| 4 | System error |

## Development

```bash
# Install
make install

# Build everything
make build

# Run tests
make test

# Run demo
make demo

# Format code
make format

# Clean artifacts
make clean
```

## Project Structure

```
├── src/              # C++ engine source
├── include/          # C++ headers
├── tests/            # C++ unit tests
├── ready-layer/      # Web dashboard (Next.js)
├── packages/         # TypeScript packages
│   ├── cli/          # CLI interface
│   ├── ui/           # UI components
│   └── ai/           # AI integrations
├── scripts/          # Verification scripts
├── docs/             # Documentation
└── build/            # Build output
```

## License

[MIT](LICENSE)
