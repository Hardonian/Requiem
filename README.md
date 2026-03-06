# Requiem (Repository) / ReadyLayer (Product)

> **Agents break because tools break.** Requiem records every tool call, classifies failures, explains root cause, and generates safe repair plans (Run → Replay → Diagnose → Repair → Prove → Diff).

Requiem is an open-source AI execution engine designed for production-grade reliability and cryptographic auditability. It replaces the "fuzzy" execution of traditional AI agents with a deterministic C++ kernel, ensuring that every run is reproducible, every artifact is content-addressed, and every decision is gated by formal policy.

**ReadyLayer** is the control plane and web console built on top of Requiem, providing deep observability into agent drift, cost anomalies, and provable execution logs.

## Naming & Components

| Canonical term | Role | Legacy/alt references |
| :--- | :--- | :--- |
| **Requiem** | OSS runtime/kernel repository and engine | `requiem` (repo/package references) |
| **ReadyLayer** | Web console / control plane | `ready-layer` (workspace/app folder) |
| **Reach CLI** | Command-line interface for verification/replay | `@requiem/cli`, `rl` script |

See [docs/overview/POSITIONING.md](./docs/overview/POSITIONING.md) for the canonical product boundary statement and [docs/README.md](./docs/README.md) for the docs index.

---

## Why Requiem?

Traditional AI execution is non-deterministic, making it impossible to audit, debug, or scale with confidence. Requiem fixes this by moving execution truth into a hardened, high-performance kernel.

- **Deterministic Kernel**: Byte-identical reproduction of any AI run across different environments.
- **Content-Addressable Storage (CAS)**: Every artifact is stored by its BLAKE3 hash. Corruption is detected on every read.
- **Policy-as-Code**: Deny-by-default execution. Tools cannot be reached without passing the formal policy gate.
- **Local Replay**: Pull any production execution bundle to your local machine and replay it exactly.

---

## 🚀 15-Minute Setup

### Prerequisites
- **Node.js**: >= 20.11.0
- **pnpm**: >= 9.x
- **CMake**: >= 3.20 (for native kernel)
- **C++17 Compiler**: Clang/GCC (Linux/macOS) or MSVC (Windows)

### Install & Build
```bash
# Clone the repository
git clone https://github.com/reachhq/requiem.git && cd requiem

# Install dependencies
pnpm install

# Build the native kernel & TypeScript packages
pnpm build
```

### Run the Demo
Experience the full verification pipeline in under 60 seconds.
```bash
pnpm verify:demo
```
Expected output includes:
✅ Plan verification & hashing
✅ Deterministic receipt generation
✅ Event log integrity verification

---

## CLI Cheatsheet

Reach CLI (`rq`) provides the operator interface for interacting with the kernel and managing executions.

```bash
# 30-second Tool Failure Intelligence demo
rq run web.fetch --input '{"url":"https://127.0.0.1:9"}'
rq diagnose <run_id>
rq repair <run_id> --plan
rq diff <baseline_run_id> <failed_run_id>

# Run a diagnostic check
pnpm doctor

# Inspect a plan hash
rq inspect <hash> --json

# Check log integrity
rq verify <hash> --replay

# List active entitlements
rq trust show --json
```

---

## Web Console

The ReadyLayer dashboard provides a visual control plane for your AI operations.

```bash
# Start the web console locally
pnpm --filter ready-layer dev

# Verify route completeness + API hardening + smoke checks
pnpm --filter ready-layer test && pnpm --filter ready-layer build && pnpm --filter ready-layer test:e2e
```
Open [http://localhost:3000](http://localhost:3000) to view:
- **Home / Docs / Pricing**: Entry points for product and technical onboarding.
- **Console**: Operations shell (runs, plans, policies, capabilities, finops, snapshots).
- **Status**: Runtime diagnostics (build SHA, environment, prompt/core identifiers, backend reachability).
- **Registry / Spend / Drift / Settings**: Control plane views for policy and runtime operations.

---

## Architecture

```text
┌─────────────────────────────────┐
│ ReadyLayer Web UI (Next.js)     │ <── Dashboard & Observability
├─────────────────────────────────┤
│ AI Control Plane (TS/CLI)       │ <── Policy Gate & MCP Transport
├─────────────────────────────────┤
│ Requiem Kernel (C++17)          │ <── Determinism, CAS, Hashing
└─────────────────────────────────┘
```
See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for a deep dive into data flow and tenant isolation.

---

## Positioning

### Why not just GitHub Actions + OPA + Postgres?

| Feature | GH Actions + OPA + PG | Requiem / ReadyLayer |
| :--- | :--- | :--- |
| **Determinism** | Fuzzy / Best effort | Byte-for-byte identical |
| **Integrity** | DB record (nullable) | Merkle-linked CAS (immutable) |
| **Isolation** | Shared worker | Hardened worker sandbox |
| **Audit** | Log-based | Cryptographically signed proofs |
| **Replay** | Re-run (not replay) | Exact state-match replay |

---

## Security & Limitations

Requiem takes an honest approach to security. We distinguish between implemented features and aspirational stubs.

- **Status**: See [docs/THEATRE_AUDIT.md](./docs/THEATRE_AUDIT.md) for the "No Theatre" implementation matrix.
- **Isolation**: Currently uses Job Objects (Windows) and rlimits (Linux). Seccomp sandbox is in progress.
- **Authentication**: JWT validation for production MCP transport is currently stubbed (requires auth provider integration).

---

## License & Support

- **License**: Apache-2.0. See [LICENSE](./LICENSE).
- **Support**: See [SUPPORT.md](./SUPPORT.md).
- **Contributing**: We welcome PRs. See [CONTRIBUTING.md](./CONTRIBUTING.md).
