# Route Maturity Map

This map is a trust aid for first-clone reviewers. It distinguishes routes that prove runtime behavior from routes that are intentionally thin, degraded, or informational.

## Console routes

| Route | Maturity | Runtime dependency | Notes |
| --- | --- | --- | --- |
| `/console/overview` | runtime-degraded | `REQUIEM_API_URL` for live metrics | Shows explicit standby state when backend is not configured. |
| `/console/architecture` | runtime-degraded | backend connectivity checks | Presents degraded diagnostics instead of fabricated health. |
| `/console/guarantees` | runtime-degraded | `REQUIEM_API_URL` | Claims are bounded to verification links and backend connectivity. |
| `/console/logs` | runtime-backed | API/log feed | Primary runtime operations surface. |
| `/console/runs` | runtime-backed | API/run backend | Primary deterministic execution evidence surface. |
| `/console/policies` | runtime-backed | API/policy backend | Runtime policy evidence and decisions. |
| `/console/capabilities` | runtime-backed | API/auth capability backend | Token/capability management surface. |
| `/console/finops` | runtime-backed | `/api/budgets` | Backend route is demo-safe when engine is absent. |
| `/console/plans` | demo | `/api/plans` | Explicitly demo-backed in current OSS surface. |
| `/console/snapshots` | demo | `/api/snapshots` | Explicitly demo-backed in current OSS surface. |
| `/console/replication` | informational | none | Static reference topology; not live region telemetry. |

## Non-console supporting routes

| Route group | Maturity | Runtime dependency | Notes |
| --- | --- | --- | --- |
| `/app/*` | runtime-degraded | auth + `REQUIEM_API_URL` for live data | Authenticated shell with explicit standby/degraded states. |
| `/auth/*` | runtime-backed | auth provider config | Sign-in/up/reset flows require configured auth. |
| `/docs`, `/about`, `/support`, `/terms`, `/privacy` | informational | none | Static/supporting documentation and policy routes. |

## Interpretation rules

- **runtime-backed:** expected to show live behavior with configured backend/auth.
- **runtime-degraded:** route remains truthful without required env/backend; explicitly signals missing dependencies.
- **demo:** route currently serves demo-safe or mocked backend behavior in OSS.
- **informational:** static/supporting route with no live runtime claims.
