# Authenticated Route Control Truth Inventory

This inventory covers major authenticated route families and enumerates meaningful controls, semantic type, backend dependencies, screenshot visibility, and required disposition.

## Route-family inventory (major authenticated surfaces)

| Route family | Representative routes | Purpose | Route truth classification | Renderable state variants | Meaningful controls |
|---|---|---|---|---|---|
| `/app/*` | `/app/executions`, `/app/replay`, `/app/tenants`, `/app/cas`, `/app/audit`, `/app/policy`, `/app/metrics`, `/app/diagnostics`, `/app/interop` | Operational evidence and tenant/runtime diagnostics | Mostly `runtime-backed` or `runtime-degraded` | auth required, backend missing, backend unreachable, forbidden, no-data, local-only informational | Retry query, verify replay, export audit logs, navigation to run/docs, local-only preview actions |
| `/console/*` | `/console/overview`, `/console/runs`, `/console/logs`, `/console/policies`, `/console/capabilities`, `/console/finops`, `/console/snapshots`, etc. | Control plane operations and runtime evidence | mixed: `runtime-backed`, `runtime-degraded`, `demo`, `informational` | loading, fetch error, no-data, populated, route maturity disclosure | Verify run, revoke capability, reset budget window, restore snapshot, tab switch, row expand, pagination |
| `/intelligence/*` | `/intelligence/verification`, `/intelligence/cases`, `/intelligence/signals`, `/intelligence/learning`, `/intelligence/foundry*`, `/intelligence/calibration*` | Intelligence analytics and model verification | mixed (`runtime-degraded` + local/informational surfaces) | no data, backend dependency degraded, informational/local render | detail/navigation links, dataset/run navigation, stateful filters |
| `/runs` | `/runs`, `/runs/[runId]` | run index and run detail drill-down | marketing handoff + runtime detail | index info state, detail state with links and local interaction | nav to console runs, copy/show details, diff/lineage links |
| `/registry` | `/registry`, `/registry/[pkg]` | package/registry browsing | protected route truth shell + route-level data states | backend missing/unreachable/no-data/populated | navigation links, informational details |
| `/spend` | `/spend`, `/spend/policies` | spend posture + policy handoff | mostly informational + route shell truth | informational-only states | navigation to console policies |
| `/drift` | `/drift`, `/drift/[vector]` | drift diagnostics overview/detail | runtime-degraded/read-only | backend unreachable/no data/populated | row/detail navigation |
| `/settings` | `/settings` | tenant/org settings posture | protected route shell with explicit state cards | auth/backend dependent state cards | save/update controls where wired, informational cards |

## Action-level control inventory and disposition

| Route | Control label | Component/file | Semantic type | Backend dependency | Screenshot-visible semantics | Required disposition | Status |
|---|---|---|---|---|---|---|---|
| `/console/runs` | Verify | `src/app/console/runs/page.tsx` | runtime mutation/fetch (`GET /api/runs/:id/diff`) | required | yes (button copy + result badge) | keep runtime-backed, ensure unavailable states show exact reason | already enforced |
| `/console/runs` | Previous/Next | `src/app/console/runs/page.tsx` | local pagination trigger + runtime fetch | required | yes | keep as navigation/fetch, disable on bounds | already enforced |
| `/console/logs` | Expand details chevron | `src/app/console/logs/page.tsx` | local-only interaction | none | yes | keep and label as local details-only where copy exists | partially enforced |
| `/console/logs` | Previous/Next | `src/app/console/logs/page.tsx` | runtime fetch pagination | required | yes | keep with bounded disable semantics | already enforced |
| `/console/finops` | Reset Window | `src/app/console/finops/page.tsx` | runtime mutation | required | yes | keep runtime-backed; surface backend/auth failures distinctly | partially enforced |
| `/console/capabilities` | Revoke | `src/app/console/capabilities/page.tsx` | runtime mutation | auth + backend | yes | keep runtime-backed; keep confirmation + failure display | already enforced |
| `/console/policies` | Policies / Recent Decisions tabs | `src/app/console/policies/page.tsx` | local-only interaction | none | yes | keep as local tab-switch only | already enforced |
| `/console/snapshots` | Restore | `src/app/console/snapshots/page.tsx` | ambiguous before; now disabled when demo-backed | runtime required | yes | disable with precise reason unless runtime-backed | **fixed** |
| `/app/replay` | Retry runs query | `src/app/app/replay/page.tsx` | runtime fetch | required | yes via truth action button semantics | keep runtime-backed classification | already enforced |
| `/app/replay` | Verify | `src/app/app/replay/page.tsx` | runtime fetch/verify | required | yes | keep runtime-backed; keep explicit failure-kind mapping | already enforced |
| `/app/tenants` | Retry tenant isolation query | `src/app/app/tenants/page.tsx` | runtime fetch | required | yes | keep runtime-backed with failure-class card | already enforced |
| `/app/cas` | Retry CAS integrity | `src/app/app/cas/page.tsx` | runtime fetch | required | yes | keep runtime-backed semantics | already enforced |
| `/app/interop` | Approve correction proposal | `src/app/app/interop/page.tsx` | local-only disabled | none | yes | keep disabled with explicit no API reason | already enforced |
| `/app/interop` | Open PR | `src/app/app/interop/page.tsx` | informational disabled | none | yes | keep disabled with explicit no PR wiring reason | already enforced |

## Completed change in this pass

- `/console/snapshots` restore mutation now checks route maturity and is blocked unless route is truly `runtime-backed`.
- Disabled-state copy now explicitly states restore is unavailable on demo-backed routes and adds screenshot-visible reason text.
- Added targeted regression test to prevent reintroduction of ambiguous restore authority on demo routes.

## Remaining prioritized follow-up work

1. Add consistent control-semantic badges/tooltips for local-only row expand controls in logs and other table detail toggles.
2. Extend explicit control inventory tests to `finops`, `capabilities`, and `runs` action semantics.
3. Add route-level UI tests for backend-missing vs backend-unreachable copy in remaining major route families.
