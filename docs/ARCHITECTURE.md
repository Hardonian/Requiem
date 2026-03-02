# Requiem Architecture

> **Version:** 1.4.0  
> **Last Updated:** 2026-03-01  
> **Status:** Production

## Overview

Requiem is a deterministic execution engine and provable AI runtime designed for reproducible builds, test isolation, and cryptographic verification of computation. It provides a multi-layered architecture that separates concerns between native execution, control-plane logic, and AI reasoning.

### Core Principles

1. **Determinism First**: Same inputs always produce identical outputs.
2. **Provable AI**: Every AI decision produces a cryptographic fingerprint and verifiable trace.
3. **Defense in Depth**: Multiple layers of validation and enforcement (Native Sandbox + Policy Gate).
4. **Server-Side Authority**: Tenant resolution and access control are server-side only.

---

## Layer Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (ready-layer)                                     │
│  - React/Next.js dashboard                                  │
│  - Proof visualization and drift analysis                   │
├─────────────────────────────────────────────────────────────┤
│  AI Control Plane (packages/ai)                             │
│  - MCP Server / Tool Registry                               │
│  - Policy Gate (deny-by-default)                            │
│  - Skill Runner / Model Arbitrator                          │
├─────────────────────────────────────────────────────────────┤
│  Control Plane (packages/cli)                               │
│  - Tenant Resolution / DB Integration                       │
│  - Structured Error Envelopes                               │
├─────────────────────────────────────────────────────────────┤
│  Native Engine (src/*.cpp)                                  │
│  - BLAKE3 Hashing / CAS v2 Storage                          │
│  - Sandbox Isolation / Replay Validation                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Boundaries

### Import Rules (Enforced by ESLint)

| From ↓ \ To → | Native        | Core (TS) | AI       | UI  |
| ------------- | ------------- | --------- | -------- | --- |
| **Native**    | ✅            | ❌        | ❌       | ❌  |
| **Core (TS)** | ✅ (Adapter)  | ✅        | ❌       | ❌  |
| **AI**        | ✅ (via Core) | ✅        | ✅       | ❌  |
| **UI**        | ❌            | ✅ (API)  | ✅ (API) | ✅  |

---

## Key Components

### 1. Native Engine (C++17)

The performance-critical layer providing cryptographic primitives and execution sandboxing.

- **BLAKE3**: Domain-separated hashing (`req:`, `res:`, `cas:`, `audit:`).
- **CAS v2**: Content-addressable storage optimized for large execution logs.
- **Sandbox**: Seccomp-BPF (Linux) and Job Objects (Windows) for process isolation.

### 2. Policy Gate (`packages/ai/src/policy/`)

The security boundary between untrusted agent reasoning and trusted system tools.

- **Deny-by-default**: Every tool invocation must be explicitly allowed.
- **RBAC**: Capability-based access control.
- **Budgets**: Resource and token limits enforced at the tool boundary.

### 3. MCP Server & Tool Registry (`packages/ai/src/mcp/`)

Standardized interface for exposing system capabilities to AI agents.

- **Registry**: Versioned tool definitions with JSON Schema validation.
- **Invoke**: Unified entry point that handles policy, validation, and auditing.

### 4. Structured Error Envelope (`packages/cli/src/lib/errors.ts`)

Unified error handling with stable identifiers used across all layers.

---

## Data Flow (The Decision Path)

1. **Request**: A tool call or AI decision request enters the system.
2. **Auth**: Tenant context is derived server-side from JWT/API Key.
3. **Registry**: The requested tool/skill is looked up in the registry.
4. **Policy**: The Policy Gate evaluates the request against active constraints.
5. **Execution**: If allowed, the Native Engine executes the task in a sandbox.
6. **Proof**: A BLAKE3 result digest is computed and stored in CAS.
7. **Audit**: The transaction is recorded in the tamper-evident Merkle audit chain.

---

## References

- [INVARIANTS.md](./INVARIANTS.md) — Hard system constraints
- [SECURITY.md](./SECURITY.md) — Security and Cryptography
- [DETERMINISM.md](./DETERMINISM.md) — Determinism guarantees
- [cli.md](./cli.md) — CLI Reference (Reach / Requiem)
