# Requiem Architecture & Determinism

> **Status:** Production-bound.  
> **Target:** Zero-entropy execution.

Requiem is built on a multi-layered architecture that separates concerns between native execution truth and higher-level AI orchestration. This document outlines how we achieve determinism, isolation, and cryptographic auditability.

---

## 1. High-Level Layers

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

### The Kernel Boundary
Truth resides in the C++ kernel. The TypeScript layers are responsible for orchestration, but any state that must be verified (plans, receipts, logs) is processed by the native engine using **BLAKE3** hashing with domain separation.

---

## 2. Core Components

### A. Deterministic Kernel (C++17)
The kernel ensures that given the same input, you get the exact same byte-for-byte output.
- **Environment Sanitization**: Prior to hashing, we strip process-specific metadata (timestamps, PIDs, environment variables).
- **BLAKE3 Domain Separation**: Different data types (plans, receipts, audit logs) use unique hash domains to prevent collision.
- **Replay Engine**: Allows loading a past execution bundle and re-running it to verify the result hasn't drifted.

### B. Content-Addressable Storage (CAS v2)
Requiem does not use traditional file paths for state. Everything is stored by its BLAKE3 hash.
- **Dual-Hash Verification**: We store objects with BLAKE3 and SHA-256 digests.
- **Integrity Checks**: Every read operation re-verifies the digest. Bit-rot is identified immediately.

### C. Policy Gate (`packages/ai/src/policy/`)
A deny-by-default boundary between agent reasoning and system tools.
- **Guardrails**: Content and behavioral filters.
- **Budgets**: Resource limit enforcement (tokens, cost, time).
- **Capability RBAC**: Fine-grained tool access controlled by tenant context.

---

## 3. Data Flow: The Path of an Execution

1.  **Request**: An agent requests a tool invocation.
2.  **Context**: The system identifies the tenant and loads their policy.
3.  **Gate**: The Policy Gate evaluates the request. If it violates a guardrail or exceeds a budget, it is rejected with a structured `E_POL_VIOLATION` envelope.
4.  **Sandbox**: If allowed, the kernel executes the task in a confined workspace (Job Objects on Windows, rlimits on Linux).
5.  **Proof**: The kernel computes a result digest.
6.  **Ledger**: The transaction, including the proof, is committed to the Merkle-linked event log.

---

## 4. Isolation & Security Guarantees

We distinguish between **Guaranteed** and **In-Memory** isolation:

| Guarantee | Mechanism | Scope |
| :--- | :--- | :--- |
| **Path Confinement** | Sandbox Workspace | Guaranteed |
| **Resource Limits** | rlimits / Job Objects | Guaranteed |
| **Determinism** | BLAKE3 / Canonical JSON | Guaranteed (Verified by 200x CI gate) |
| **Tenant Budget** | In-memory counters | **Limited** (Resets on restart) |
| **Syscall Filter** | Seccomp-BPF | In Progress (Linux only) |

---

## 5. Merkle Audit Chain

Requiem maintains a tamper-evident audit trail of all core decisions. Each record in the event log contains a link to the previous record's hash. A single root hash can be used to verify the entire history of the system.

- **Storage**: NDJSON append-only logs.
- **Verification**: `pnpm req log verify` walks the chain and re-computes all hashes.

---

## References
- [INVARIANTS.md](./INVARIANTS.md) — System-wide constraints.
- [DETERMINISM.md](./DETERMINISM.md) — Technical spec for reproducibility.
- [THEATRE_AUDIT.md](./THEATRE_AUDIT.md) — Implementation status of security features.


## Canonical Product Convergence
See `docs/architecture/CANONICAL_PRODUCT_MODEL.md` and `docs/architecture/TERMINOLOGY_MAP.md` for unified naming across Requiem kernel, ReadyLayer control plane, and CLI operations.
