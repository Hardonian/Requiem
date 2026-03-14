# Platform Ecosystem Roadmap (No speculative promises)

## Stage 1: Harden Existing Extension Surface

- Publish and enforce plugin interface schema.
- Emit capability graph snapshots from CLI/API.
- Add extension conformance checks in CI.

## Stage 2: Safe Orchestration Upgrades

- Introduce orchestrator SPI while retaining current local queue backend.
- Add deterministic queue audit logs and replay fixtures.
- Add per-workflow tenancy/policy conformance tests.

## Stage 3: Ecosystem Tooling

- Provide extension SDK wrappers for manifest validation and context binding.
- Add signed registry metadata for plugin and workflow discovery.
- Add operator-facing compatibility matrix for core ↔ extension versions.

## Stage 4: Multi-Repo Control Plane Maturity

- Add remote executor adapter with explicit trust policy.
- Add cross-repo provenance bundle spec.
- Add bounded failure semantics for partial multi-repo execution.

