# Requiem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](#verification)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green)](#quickstart)

Deterministic AI execution platform with tenant isolation, replay, and audit.

## What This Is

| Component | Description |
|-----------|-------------|
| **Requiem Engine** | C++ native runtime for deterministic process execution, CAS, and replay verification |
| **ReadyLayer** | Next.js web dashboard — the user-facing control plane at [readylayer.com](https://readylayer.com) |
| **Reach CLI** | TypeScript CLI for tool execution, decision engine, junctions, and AI agent orchestration |
| **@requiem/ai** | AI subsystem: MCP tools, skills, telemetry, policy, and evaluation |
| **@requiem/ui** | Shared React component library and design tokens |

## Who It's For

Teams that need **auditable, reproducible AI agent execution** with governance controls:
policy enforcement at every step, signed artifacts, tenant isolation, and deterministic replay.

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

```text
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
└── contracts/          # Compatibility and determinism contracts
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
