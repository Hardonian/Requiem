# Route Maturity Map

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
