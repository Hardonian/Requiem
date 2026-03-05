# Kernel Architecture

Requiem is the repository and deterministic kernel implementation. ReadyLayer is the product surface.

## Invariants
- Deterministic replay is enforced through canonical inputs and append-only logs.
- CAS uses BLAKE3 artifact hashes.
- Tenant isolation derives from authenticated tenant context and never caller-provided payload fields.
