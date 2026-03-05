# Canonical Product Model

## Product Convergence

- **Requiem**: deterministic execution kernel and primitive runtime.
- **ReadyLayer**: control plane UI and operator console.
- **Requiem CLI**: operational interface for automation, diagnostics, replay, and proofs.
- **CAS/WAL**: immutable storage primitives consumed by kernel and surfaced through CLI/UI.

## Layered Model

1. **Kernel Layer (Requiem)**
   - Deterministic execution
   - Policy gates
   - Replay correctness
2. **Storage Primitive Layer (CAS/WAL)**
   - Content-addressed object store
   - Append-only event history
3. **Operator Interface Layer (CLI)**
   - Verification, diffing, tracing, diagnostics
4. **Control Plane Layer (ReadyLayer)**
   - Visual observability and administration

## Backward Compatibility Policy

Legacy terms (`Reach`, `daemon`, `console`) remain accepted in docs/CLI where required for migration clarity, but canonical wording should default to the model above.
