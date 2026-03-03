# BIG4 Architecture Baseline (Reality Pass)

## Existing vs New

| Area | Existing in repo | New in this change |
|---|---|---|
| Replay/Audit | CLI replay and audit commands already exist (`packages/cli/src/commands/replay.ts`, `packages/cli/src/commands/audit.ts`). | Shared canonical JSON + run envelope foundation in `packages/core/src/*` and append-only audit store abstraction in `packages/audit/src/*`. |
| Registry | Agent/tool/runtime concepts exist in CLI (`packages/cli/src/lib/agent-runner.ts`, `packages/cli/src/commands/agent.ts`). | Feature-flag and tenant config foundation for a verified registry rollout (`packages/core/src/feature-flags.ts`, `packages/core/src/tenant-config.ts`). |
| Spend firewall | Economic accounting primitives already exist (`packages/cli/src/lib/economic-layer.ts`). | Shared request-context and rate-limit middleware for API hardening (`packages/http/src/*`). |
| Drift radar | Drift detector and microfracture drift engines already exist (`packages/cli/src/lib/drift-detector.ts`, `packages/cli/src/lib/microfracture/drift-engine.ts`). | Deterministic canonical hashing primitives reusable for stable fingerprinting (`packages/core/src/canonical-json.ts`, `packages/core/src/hash.ts`). |

## Repo map (Phase 0)

- Engine kernel (OSS C++): `src/`, `include/requiem/`, `tests/`.
- CLI orchestration + storage: `packages/cli/src/**`.
- Web console + API routes (Next.js): `ready-layer/src/app/**` and `ready-layer/src/app/api/**`.
- Policy/governance artifacts: `policy/`, `contracts/`, `guarantees/`.
- CAS/runtime state: `.requiem/cas/` and associated CLI storage helpers (`packages/cli/src/db/artifacts.ts`).

## Invariants enforced by this scaffold

1. Canonical JSON and deterministic hashing for run payload surfaces.
2. Run envelope has a single schema/type + validator for stable transport and replay.
3. Audit interface is append-only by design (`append` + paginated `list`).
4. Request context includes tenant, actor, request, trace IDs and structured failure output.
5. Big 4 features are explicitly gateable via shared flags (`BIG4_REPLAY`, `BIG4_REGISTRY`, `BIG4_SPEND`, `BIG4_DRIFT`).

## Notes

- This change is intentionally foundational: it creates production-safe primitives reusable by CLI, API routes, and web UI without deleting or regressing existing flows.
- Existing determinism and route safety checks remain unchanged and are still expected to pass via existing scripts (`scripts/verify_determinism.sh`, `scripts/verify_routes.sh`).
