# Route Maturity Map

Canonical source of truth is code, not this document:

- `ready-layer/src/lib/route-maturity.ts`

This file defines route maturity class, runtime dependency class, auth/backend expectations, disclosure requirements, nav status treatment, CTA restrictions, and degraded behavior messaging for each console-promoted route.

## Taxonomy

- `runtime-backed`: expected to show live backend/auth behavior.
- `runtime-degraded`: route remains truthful when backend/auth/env is absent.
- `demo`: intentionally demo-safe behavior; not production proof.
- `informational`: static or explanatory route with no live-runtime claim.
- `local-only`: local runtime dependency.
- `unavailable`: intentionally not operational.

## Enforcement

- `pnpm run verify:routes` includes `pnpm --filter ready-layer verify:route-maturity`.
- `ready-layer/scripts/verify-route-maturity.ts` validates:
  - every catalog route has an implemented page,
  - routes that require disclosure render `RouteMaturityNote`,
  - maturity/status invariants (for example demo routes must be `navStatus=demo`).
- Console navigation is derived from `routeMaturityCatalog`, so labels/status cannot silently drift from route maturity definitions.

For first-clone reviewers, run:

```bash
pnpm run verify:routes
pnpm run verify:all
```
