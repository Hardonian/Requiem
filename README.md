# Requiem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](#verification)
[![Node](https://img.shields.io/badge/node-20.x-green)](#quickstart)

Deterministic AI execution platform with tenant isolation, replay, and audit.

## What This Is

| Component | Description |
|-----------|-------------|
| **Requiem Engine** | C++ native runtime for deterministic process execution, CAS, and replay verification |
| **ReadyLayer** | Next.js web dashboard — the user-facing control plane |
| **Reach CLI** | TypeScript CLI for tool execution, decision engine, junctions, and AI agent orchestration |
| **@requiem/ai** | AI subsystem: MCP tools, skills, telemetry, policy, and evaluation |
| **@requiem/ui** | Shared React component library and design tokens |

## Who It's For

Teams that need **auditable, reproducible AI agent execution** with governance controls:
policy enforcement at every step, signed artifacts, tenant isolation, and deterministic replay.

## Key Differentiators

- 🔒 **[Deterministic Execution](docs/DETERMINISM.md)** — Cryptographically verified reproducibility with BLAKE3; 200× repeat CI gate
- 📦 **[Content-Addressable Storage](docs/CAS.md)** — Dual-hash verified (BLAKE3 + SHA-256), zstd-compressed, corruption-detecting CAS
- 🛡️ **[Policy-as-Code](docs/POLICY.md)** — Machine-enforced guardrails, budgets, and RBAC; every AI request passes the Gate
- 📐 **[Formally Verified](formal/README.md)** — TLA+ specifications for Determinism, CAS, Protocol, and Replay
- ⚡ **[Multi-Scheduler](include/requiem/worker.hpp)** — Repro mode (max isolation) or turbo mode (max throughput), selectable per execution
- 📊 **[Built-in Benchmarking](docs/BENCH.md)** — 200× determinism gate with latency histograms and drift detection
- 🔍 **[Honest Security Posture](docs/THEATRE_AUDIT.md)** — Theatre audit with transparent implementation status table

See [docs/DIFFERENTIATORS.md](docs/DIFFERENTIATORS.md) for detailed technical analysis and [contracts/competitive.matrix.json](contracts/competitive.matrix.json) for the machine-readable comparison matrix.

## Quickstart

```bash
# Clone and install
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install

# Run the web dashboard (ReadyLayer)
pnpm run web:dev

# Run full verification (lint + typecheck + boundaries + build)
pnpm run verify:preflight
```

### Native Engine (optional)

Requires CMake 3.20+, C++20 compiler, and OpenSSL:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    ReadyLayer (Next.js)                       │
│            Web dashboard + API routes + middleware            │
└────────────────────────┬─────────────────────────────────────┘
                         │
          ┌───────────────┼───────────────┐
          │               │               │
 ┌────────▼───────┐ ┌─────▼──────┐ ┌──────▼───────┐
 │  @requiem/ai   │ │ @requiem/ui│ │  @requiem/cli│
 │  MCP + Skills  │ │ Components │ │  Reach CLI   │
 └────────┬───────┘ └────────────┘ └──────┬───────┘
          │                               │
 ┌────────▼───────────────────────────────▼───────┐
 │              Requiem Engine (C++)               │
 │   Sandbox │ CAS │ Replay │ BLAKE3 │ Policy     │
 └────────────────────────────────────────────────┘
```

## Repository Structure

```
requiem/
├── ready-layer/        # ReadyLayer web app (Next.js 15)
├── packages/
│   ├── ai/             # AI subsystem (MCP, skills, telemetry)
│   ├── cli/            # Reach CLI (decision engine, junctions, tools)
│   └── ui/             # Shared component library
├── src/                # C++ engine source
├── include/            # C++ headers
├── scripts/            # Verification and build scripts
├── docs/               # Documentation
├── formal/             # TLA+ formal specifications
└── contracts/         # Compatibility and determinism contracts
```

## Verification

```bash
# Full preflight (recommended before any PR)
pnpm run verify:preflight

# Individual checks
pnpm run verify:lint          # ESLint
pnpm run verify:typecheck     # TypeScript
pnpm run verify:boundaries    # Import boundary checks
pnpm run build:web            # Next.js production build

# E2E tests
pnpm run test:e2e             # Playwright tests
```

## Documentation

- [Getting Started](docs/GETTING_STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Determinism Invariants](docs/DETERMINISM.md)
- [Security](docs/SECURITY.md)
- [CAS Specification](docs/CAS.md)
- [CLI Reference](docs/cli.md)
- [Enterprise Features](docs/enterprise.md)
- [Troubleshooting](docs/troubleshooting.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) — See [SECURITY.md](SECURITY.md) for vulnerability reporting.
