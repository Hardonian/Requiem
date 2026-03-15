# Authenticated Route Truth Matrix (Local Verification)

This document describes what the authenticated product surface *actually* does in this repository, and how to validate it without weakening production auth.

## Safe local authenticated verification

Use middleware-backed verify mode for local evidence capture only:

```bash
PORT=3005 REQUIEM_ROUTE_VERIFY_MODE=1 REQUIEM_ROUTE_VERIFY_TENANT=ux-evidence pnpm --filter ready-layer dev
```

Behavior in this mode:

- Only active when `REQUIEM_ROUTE_VERIFY_MODE=1` **and** `NODE_ENV !== production`.
- Middleware injects authenticated headers for protected pages/APIs (`x-requiem-authenticated`, `x-user-id`, `x-tenant-id`).
- Production auth flow remains unchanged.
- Sign-in UX is still real-mode by default when verify mode is not enabled.

## Dependency semantics used by authenticated routes

- **Auth required:** Any route under `/app`, `/console`, `/intelligence`, `/runs`, `/registry`, `/settings`, `/drift`, `/spend`.
- **Public exception:** `/proof/diff/[token]` remains public share-link access.
- **Backend configured state:** `REQUIEM_API_URL` present.
- **Backend missing state:** `REQUIEM_API_URL` absent.
- **Backend unreachable state:** `REQUIEM_API_URL` set to a non-responsive endpoint.
- **Engine/runtime dependent:** pages that call `/api/engine/*` or runtime-backed APIs.

## Protected route inventory and runtime class

| Route prefix / page | Class | Primary dependency | Local truth status |
|---|---|---|---|
| `/console/overview`, `/console/logs`, `/console/decisions`, `/console/objects`, `/console/replication` | Informational/mixed | Auth + optional backend context | Healthy (truthful static content with explicit operational banner) |
| `/console/architecture`, `/console/guarantees`, `/console/runs`, `/console/plans`, `/console/policies`, `/console/capabilities`, `/console/finops`, `/console/snapshots` | Runtime-backed | Auth + backend/API | Degraded-but-truthful when backend missing/unreachable (error/empty states visible) |
| `/app/executions`, `/app/metrics`, `/app/policy`, `/app/semantic-ledger`, `/app/interop` | Informational/mixed | Auth + optional backend | Healthy for shell/info; runtime claims are dependency-bound |
| `/app/replay`, `/app/audit`, `/app/cas`, `/app/tenants`, `/app/diagnostics` | Runtime-backed | Auth + backend/API (+ engine for diagnostics endpoints) | Degraded-but-truthful when runtime unavailable |
| `/intelligence/*` | Mostly informational/local simulations with guarded API usage | Auth + per-page data source | Thin-but-safe (non-theatrical, dependency-constrained) |
| `/runs`, `/runs/[runId]`, `/registry`, `/registry/[pkg]`, `/drift`, `/drift/[vector]`, `/spend`, `/spend/policies`, `/settings` | Mixed | Auth + optional backend/data | Safe empty/degraded states |

## Operator-readable state model

Authenticated layouts now always expose:

1. **Auth mode truth**
   - real auth mode, or
   - dev verification mode (explicitly labeled as synthetic auth)
2. **Backend dependency truth**
   - backend configured (`REQUIEM_API_URL` set), or
   - backend not configured (`REQUIEM_API_URL` missing)

This prevents ambiguous “looks connected” posture on first load.

## Evidence capture checklist

Capture at minimum:

1. Authenticated landing (`/console/overview`)
2. Missing-backend degraded runtime route (`/console/runs` with `REQUIEM_API_URL` unset)
3. Backend-unreachable degraded route (`/app/diagnostics` with non-responsive `REQUIEM_API_URL`)
4. No-data/safe-empty route (`/settings`)

Recommended unreachable backend run:

```bash
PORT=3005 REQUIEM_ROUTE_VERIFY_MODE=1 REQUIEM_ROUTE_VERIFY_TENANT=ux-evidence REQUIEM_API_URL=http://127.0.0.1:65535 pnpm --filter ready-layer dev
```
