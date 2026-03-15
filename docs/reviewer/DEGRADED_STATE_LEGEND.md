# Degraded State Legend

- **A**: authenticated + backend configured + reachable.
- **B**: authenticated + backend configured + unreachable.
- **C**: authenticated + backend missing (`REQUIEM_API_URL` absent).
- **D**: authenticated + no data (empty list/object results).
- **E**: authenticated + engine/runtime unavailable (route returns explicit unavailable/problem semantics).
- **F**: authenticated + forbidden/unauthorized (problem+json 401/403 from route auth checks).
- **G**: unauthenticated access (middleware redirect to `/auth/signin` for page routes).
- **H**: dev verify mode (`REQUIEM_ROUTE_VERIFY_MODE=1` and `NODE_ENV!=production`) with synthetic middleware headers.
- **I**: real auth mode (verify mode disabled; Supabase session required).

## In-product enforcement added in this closure pass

The authenticated product surface now uses shared primitives so these states are visible and structurally distinct in-route, not only documented:

- `ready-layer/src/lib/route-truth.ts` classifies runtime failures into explicit state kinds (`backend-missing`, `backend-unreachable`, `forbidden`, `no-data`, `engine-unavailable`, `auth-required`, `unknown`).
- `ready-layer/src/components/ui/RouteTruthStateCard.tsx` renders state label, cause, and next step using a consistent screenshot-visible format.
- `ready-layer/src/components/ui/TruthActionButton.tsx` renders action semantics and unavailable reason so disabled controls no longer hide why they are disabled.
- `/app/cas`, `/app/replay`, and `/app/tenants` now consume these primitives and expose explicit retry semantics as runtime-backed actions.

Auth validity, backend configuration, backend reachability, and data availability remain independent signals and must be interpreted separately.
