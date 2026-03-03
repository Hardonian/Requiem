# Executive Summary: Requiem

## The Product

Requiem is the **Provable AI Runtime**. It provides a deterministic, secure, and auditable execution layer for AI agents and automated workflows. By treating AI execution as a semantic state machine, Requiem ensures that every decision made by an AI model is recorded, verified, and replayable.

## Who It's For

- **Enterprise AI Teams**: Building customer-facing agents that must adhere to strict compliance and safety policies.
- **Platform Engineers**: Building internal developer platforms (IDP) that need to govern how models interact with sensitive data and tools.
- **Auditors & Legal Teams**: Requiring immutable "receipts" of what an AI did and why, especially in regulated industries.

## Why Now?

As AI moves from chat interfaces to autonomous agents, the "Black Box" problem becomes an existential risk. Companies cannot deploy agents that might behave unpredictably or bypass governance. Requiem provides the "Black Box Flight Recorder" for AI, making autonomous agents safe for production.

## Differentiators

1. **Deterministic by Default**: Identical inputs always produce identical `result_digest` values. No hidden randomness.
2. **Deny-by-Default Policy Gate**: Every tool invocation must pass through a multi-layered policy gate (RBAC, budget, guardrails) before execution.
3. **Provable Receipts**: Every run produces a BLAKE3-derived cryptographic proof that can be verified against the original code and data.
4. **Byte-Level Replayability**: Any execution can be replayed from the CAS (Content-Addressable Storage) to verify divergence or drift.

## Proof Points

- **Validated Determinism**: 200x repeat verification in CI ensures 0% drift across environments.
- **Native Efficiency**: C++ core engine for high-performance hashing and sandbox management.
- **Enterprise Ready**: Built-in tenant isolation, cost accounting, and audit logging.
