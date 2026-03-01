# Requiem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](#verification)
[![Node](https://img.shields.io/badge/node-20.x-green)](#quickstart)
[![Security](https://img.shields.io/badge/security-audit_complete-brightgreen)](docs/SECURITY.md)

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

---

## Security Features

The platform implements defense-in-depth security across all layers:

### Authentication & Authorization
- **JWT Validation** — Token validation at MCP transport layer with expiry enforcement
- **Tenant Isolation** — Row-level security (RLS) policies enforced server-side
- **Role-Based Access** — MEMBER, VIEWER, ADMIN, OWNER roles with hierarchy

### Sandboxing & Isolation
- **Seccomp-BPF** — Linux syscall filtering with allowlisted calls
- **Windows Mitigations** — Job Objects, restricted tokens, ASLR
- **Workspace Confinement** — Path canonicalization with fail-closed behavior

### Audit & Compliance
- **Merkle Audit Chain** — Tamper-evident logs with hash linking
- **Correlation IDs** — Full request tracing across services
- **Proof Bundles** — Verifiable execution provenance with Merkle roots

### Threat Mitigation
- **Prompt Injection Filter** — Input sanitization for MCP tools
- **Budget Enforcement** — DB-backed budgets prevent cost overruns
- **Cost Anomaly Detection** — Statistical monitoring with alerting
- **Circuit Breaker** — Resilience against downstream failures

See [docs/SECURITY.md](docs/SECURITY.md) for complete security documentation.

---

## Deployment Requirements

### Environment Variables

Required environment variables for production deployment:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# CAS Storage
CAS_STORAGE_PATH=/data/cas

# JWT
JWT_SECRET_KEY=<base64-encoded-key>
JWT_ALGORITHM=RS256

# Feature Flags
REQUIEM_ENGINE_DUAL_RATE=0.01
REQUIEM_DEFAULT_ENGINE=requiem
REQUIEM_AUDIT_BACKEND=database
REQUIEM_PROMPT_FILTER=enabled
REQUIEM_COST_SINK=enabled

# Monitoring
PROMETHEUS_ENABLED=true
DATADOG_API_KEY=<key>
```

### Infrastructure Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 20.x | 20.x LTS |
| PostgreSQL | 14.x | 15.x |
| Memory | 4GB | 8GB+ |
| Disk (CAS) | 50GB | 500GB+ SSD |
| CPU | 2 cores | 4+ cores |

### Security Requirements

- **TLS 1.2+** — All external connections
- **MFA** — Required for admin access
- **Secrets Manager** — Store credentials in Vault/Doppler
- **Network Segmentation** — DMZ, app tier, data tier

---

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

---

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

---

## Verification

### Pre-flight Checks

```bash
# Full preflight (recommended before any PR)
pnpm run verify:preflight

# Individual checks
pnpm run verify:lint          # ESLint
pnpm run verify:typecheck     # TypeScript
pnpm run verify:boundaries    # Import boundary checks
pnpm run build:web            # Next.js production build
```

### Test Suites

```bash
# E2E tests
pnpm run test:e2e             # Playwright tests

# AI verification suite
pnpm run verify:mcp           # MCP protocol tests
pnpm run verify:ai-safety     # Security tests
pnpm run verify:agent-quality # Agent behavior tests
pnpm run verify:cost-accounting # Budget tests
pnpm run verify:tenant-isolation # Isolation tests
```

### CI Verification

The full verification suite runs in CI:

| Check | Command | Status |
|-------|---------|--------|
| Lint | `pnpm run verify:lint` | ✅ |
| TypeScript | `pnpm run verify:typecheck` | ✅ |
| Boundaries | `pnpm run verify:boundaries` | ✅ |
| Routes | `pnpm run verify:routes` | ✅ |
| Secrets | `bash scripts/verify-secrets.sh` | ✅ |
| Supply Chain | `bash scripts/verify-supply-chain.sh` | ✅ |
| Tenant Isolation | `bash scripts/verify-tenant-isolation.sh` | ✅ |
| MCP | `pnpm run verify:mcp` | ✅ |
| AI Safety | `pnpm run verify:ai-safety` | ✅ |
| Cost Accounting | `pnpm run verify:cost-accounting` | ✅ |

---

## Documentation

### Getting Started
- [Getting Started](docs/GETTING_STARTED.md)
- [Quickstart Guide](#quickstart)

### Architecture & Design
- [Architecture](docs/ARCHITECTURE.md)
- [Determinism Invariants](docs/DETERMINISM.md)
- [CAS Specification](docs/CAS.md)
- [Policy](docs/POLICY.md)

### Security & Compliance
- [Security](docs/SECURITY.md)
- [Threat Model](docs/THREAT_MODEL.md)
- [MCP Security Review](docs/MCP_SECURITY_REVIEW.md)
- [Theatre Audit](docs/THEATRE_AUDIT.md)

### Operations
- [Operations](docs/OPERATIONS.md)
- [Operations Runbook](docs/internal/OPERATIONS_RUNBOOK.md)
- [Migration Guide](docs/MIGRATION.md)
- [Launch Checklist](docs/LAUNCH_GATE_CHECKLIST.md)
- [Troubleshooting](docs/troubleshooting.md)

### Reference
- [CLI Reference](docs/cli.md)
- [Enterprise Features](docs/enterprise.md)
- [Contributing](CONTRIBUTING.md)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) — See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

## Support

- **Security Issues**: security@readylayer.com
- **General Inquiries**: support@readylayer.com
- **Documentation**: docs@readylayer.com
