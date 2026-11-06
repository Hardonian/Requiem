# Requiem Architecture & Determinism

Canonical architecture entrypoint for Requiem.

## High-Level Layers

```text
┌──────────────────────────────────────────┐
│ ReadyLayer Web Console (Next.js)        │ <── Visualization, Cost, Drift
├──────────────────────────────────────────┤
│ AI Control Plane (packages/ai)           │ <── MCP Server, Tool Registry
├──────────────────────────────────────────┤
│ Control Plane (packages/cli)             │ <── Tenant Resolution, Errors
├──────────────────────────────────────────┤
│ Native Kernel (src/*.cpp)                │ <── Hashing, CAS, Sandbox, Replay
└──────────────────────────────────────────┘
```

- **Engine/kernel**: `src/`, `include/requiem/`, `kernel/`
- **CLI/operator plane**: `packages/cli/`
- **Web console**: `ready-layer/`
- **Shared TS libraries**: `packages/*`

## Core Components

- **Deterministic Kernel (C++17)**: Strips process metadata prior to BLAKE3 domain-separated hashing. Provides replay engine for execution drift verification.
- **Content-Addressable Storage (CAS v2)**: BLAKE3 & SHA-256 dual-digest verification with immediate bit-rot identification.
- **Policy Gate (`packages/ai/src/policy/`)**: Deny-by-default boundary enforcing tenant isolation, guardrails, resource budgets, and tool capability RBAC.
- **Merkle Audit Chain**: Tamper-evident append-only NDJSON execution event log.

## Canonical Product Convergence

For unified naming and full product models across the Requiem kernel, ReadyLayer control plane, and CLI operations:
- `docs/architecture/CANONICAL_PRODUCT_MODEL.md`
- `docs/architecture/TERMINOLOGY_MAP.md`
- `docs/platform-index.md`
- `docs/proof-engine.md`
- `docs/cli.md`
