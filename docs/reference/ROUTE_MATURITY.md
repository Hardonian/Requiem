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
Canonical source for route maturity policy lives in code: `ready-layer/src/lib/route-maturity.ts`.

This document is intentionally thin. Use it as an index and trust the canonical config + `pnpm verify:routes` guardrail for enforcement.

## Canonical policy fields

Each route entry in `ROUTE_MATURITY_RULES` declares:

- route/path
- maturity class
- runtime dependency
- disclosure requirement
- nav eligibility + nav label policy
- CTA restriction policy
- degraded behavior contract
- canonical page file

## Current guarded routes

- `/console/overview`
- `/console/architecture`
- `/console/guarantees`
- `/console/plans`
- `/console/snapshots`
- `/console/replication`
- `/demo`

## Maturity classes

- **runtime:** live behavior expected with configured backend/auth.
- **runtime-degraded:** route remains truthful when backend/env is missing and must present explicit degraded state.
- **demo:** demo-safe or scripted behavior only; must not imply production authority.
- **informational:** static/supporting route with no live operational claim.
- **local-only:** local tooling/diagnostic route with no shared runtime guarantee.
