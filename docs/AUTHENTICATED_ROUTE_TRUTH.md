# Authenticated Product Truth Matrix (Exhaustive Local Pass)

This document is the canonical reviewer artifact for authenticated UX truth in this repository.

## 1) Safe verification modes and hard guardrails

### Real auth mode
- Default mode when `REQUIEM_ROUTE_VERIFY_MODE` is unset.
- Middleware requires a real Supabase session for protected page/API prefixes.

### Dev verify mode (synthetic auth, local only)
- Enabled only when **both** conditions hold:
  - `REQUIEM_ROUTE_VERIFY_MODE=1`
  - `NODE_ENV !== production`
- Middleware injects synthetic auth headers (`x-requiem-authenticated`, `x-user-id`, `x-tenant-id`) for local validation.
- All protected shells now render a screenshot-visible warning banner: **“Synthetic authentication active (dev verification only)”**.
- Protected shells now also render a shared per-route truth card that classifies route maturity and backend dependency status directly in-product.
- Production auth behavior is unchanged.

## 2) Degraded-state legend

- **Unauthenticated**: middleware redirects protected pages to `/auth/signin` or returns 401 problem JSON for protected APIs.
- **Dev verify mode**: synthetic auth path for local validation only, explicitly disclosed in UI chrome.
- **Backend missing**: `REQUIEM_API_URL` unset; runtime-backed views show explicit standby/degraded language.
- **Backend unreachable**: `REQUIEM_API_URL` set but target unavailable; runtime-backed fetches show error/degraded state.
- **No data**: request succeeds, empty collection/state rendered.
- **Engine unavailable**: endpoints that depend on runtime services return degraded error states.
- **Forbidden/unauthorized**: policy/authz denials shown when route/API returns authz failure.
- **Informational/static**: route intentionally source-backed/static and must not imply live control-plane behavior.

## 3) Route truth matrix (all protected routes)

Legend: `I`=informational/static, `M`=mixed, `R`=runtime-backed, `L`=local/dev-simulated.

| Route | Purpose | Auth | Class | Dependency profile | State classification | Evidence |
|---|---|---:|---|---|---|---|
| `/app` | Authenticated execution shell landing | yes | M | auth + shell nav + env | healthy truthful shell | runtime + screenshot |
| `/app/executions` | Execution overview cards | yes | M | auth, optional backend | thin-but-safe standby when backend absent | runtime + screenshot |
| `/app/semantic-ledger` | Semantic ledger status | yes | I | auth only (route not implemented) | degraded-but-truthful (explicitly unimplemented) | source + screenshot |
| `/app/replay` | Replay verification trigger | yes | R | auth + `/api/replay/verify` + backend | actionable with explicit failure/success messages | runtime + screenshot |
| `/app/cas` | CAS integrity and object controls | yes | R | auth + backend/API | degraded-but-truthful on API failure | runtime + screenshot |
| `/app/policy` | Policy dashboard | yes | M | auth + optional policy data | thin-but-safe, explicit dependency language | runtime + screenshot |
| `/app/audit` | Audit entries and export links | yes | R | auth + audit APIs | truthful degraded/empty states | runtime + screenshot |
| `/app/metrics` | Observability summary | yes | M | auth + optional backend | thin-but-safe with env disclosure | runtime + screenshot |
| `/app/diagnostics` | Runtime health diagnostics | yes | R | auth + backend/runtime | degraded truth when runtime unavailable | runtime + screenshot |
| `/app/tenants` | Tenant isolation visibility | yes | R | auth + tenant API | runtime-backed, explicit operator context | runtime + screenshot |
| `/app/interop` | Correction proposal interop panel | yes | L | auth + local/demo interaction | informational/local-only controls | runtime + screenshot |
| `/console` | Console shell redirect | yes | M | auth + route redirect | truthful redirect to overview | runtime + screenshot |
| `/console/overview` | Signed-in control-plane summary | yes | M | auth + optional backend | healthy truthful standby copy when unconfigured | runtime + screenshot |
| `/console/architecture` | Architecture dependency map | yes | M | auth + `/api/health` optional | informational with dependency truth | runtime + screenshot |
| `/console/guarantees` | Guarantees/health panels | yes | M | auth + `/api/status` + `/api/health` | mixed; reachable vs degraded clearly shown | runtime + screenshot |
| `/console/runs` | Runtime run listing and verify action | yes | R | auth + `/api/runs` + backend | runtime-backed with loading/error states | runtime + screenshot |
| `/console/policies` | Policies + decisions tab | yes | R | auth + `/api/policies`/`/api/decisions` | runtime-backed tab state | runtime + screenshot |
| `/console/plans` | Plan/status panel | yes | M | auth + optional APIs | thin-but-safe informational | runtime + screenshot |
| `/console/capabilities` | Capability token list/revoke | yes | R | auth + capabilities API | runtime-backed revoke action | runtime + screenshot |
| `/console/finops` | Cost/finops status | yes | M | auth + optional budget APIs | truthful degraded/no-data states | runtime + screenshot |
| `/console/logs` | Event logs list + pagination | yes | R | auth + logs API | runtime-backed list/pagination | runtime + screenshot |
| `/console/objects` | Object inventory view | yes | R | auth + objects API | runtime-backed list | runtime + screenshot |
| `/console/decisions` | Policy decisions list | yes | R | auth + decisions API | runtime-backed list | runtime + screenshot |
| `/console/replication` | Replication posture | yes | I | auth + static/source state | informational only (not live control) | source + screenshot |
| `/console/snapshots` | Snapshot list/restore | yes | R | auth + snapshots API | runtime-backed restore action with pending state | runtime + screenshot |
| `/intelligence/calibration` | Calibration overview | yes | I | auth + local/source data | thin-but-safe informational | runtime + screenshot |
| `/intelligence/calibration/[claim_type]` | Claim-type detail | yes | I | auth + local/source data | informational | runtime + screenshot |
| `/intelligence/verification` | Verification guidance | yes | I | auth + source content | informational | runtime + screenshot |
| `/intelligence/cases` | Cases index | yes | I | auth + source content | informational | runtime + screenshot |
| `/intelligence/signals` | Signals panel | yes | I | auth + source content | informational | runtime + screenshot |
| `/intelligence/learning` | Learning panel | yes | I | auth + source content | informational | runtime + screenshot |
| `/intelligence/foundry` | Foundry datasets | yes | M | auth + optional foundry APIs | mixed: source scaffolding + runtime hooks | runtime + screenshot |
| `/intelligence/foundry/[datasetId]` | Dataset detail | yes | M | auth + route param + optional APIs | mixed; truthful dependency limits | runtime + screenshot |
| `/intelligence/foundry/runs/[datasetRunId]` | Dataset run detail | yes | M | auth + route param + optional APIs | mixed; truthful dependency limits | runtime + screenshot |
| `/runs` | Runs index | yes | R | auth + runs APIs | runtime-backed index | runtime + screenshot |
| `/runs/[runId]` | Run detail | yes | R | auth + run ID + backend data | truthful 404/no-data when missing | runtime + screenshot |
| `/registry` | Registry index | yes | R | auth + objects/registry APIs | runtime-backed list | runtime + screenshot |
| `/registry/[pkg]` | Registry package detail | yes | R | auth + package slug + API | runtime-backed detail | runtime + screenshot |
| `/drift` | Drift vectors | yes | M | auth + optional drift APIs | mixed with truthful fallback | runtime + screenshot |
| `/drift/[vector]` | Drift vector detail | yes | M | auth + param + optional APIs | mixed truthful fallback | runtime + screenshot |
| `/spend` | Spend overview | yes | R | auth + budgets APIs | runtime-backed with degraded/no-data handling | runtime + screenshot |
| `/spend/policies` | Spend policy view | yes | M | auth + policy APIs | mixed truthful state messaging | runtime + screenshot |
| `/settings` | Settings shell | yes | I | auth + local config copy | thin-but-safe informational | runtime + screenshot |

## 4) Action truth matrix (meaningful controls)

| Route | Control | User interpretation | Actual behavior | Final classification |
|---|---|---|---|---|
| `/app/replay` | `Verify` button | trigger replay verification | calls `/api/replay/verify`; surfaces result/error text | runtime-backed |
| `/app/replay` | `Open /console/runs` link | navigate to run list | client navigation only | informational navigation |
| `/app/audit` | export links (`json/csv`) | download audit data | calls `/api/audit/logs?format=*` | runtime-backed |
| `/app/interop` | `Approve correction proposal` | execute governance change | explicitly disabled; no approval API wired on this route | disabled truthfully (local-only) |
| `/app/interop` | `Open PR` | open repo workflow | explicitly disabled; page does not create pull requests | disabled truthfully (informational) |
| `/console/runs` | row `Verify`/actions + pagination | inspect and verify runs | API-backed list + action handlers | runtime-backed |
| `/console/policies` | tab switch (`Policies`/`Recent Decisions`) | fetch/swap policy views | client tab + API-backed datasets | mixed truthful |
| `/console/capabilities` | `Revoke` | revoke capability token | API-backed revoke; disabled while pending | runtime-backed |
| `/console/logs` | `Previous`/`Next` | page through logs | API-backed pagination; disabled at limits | runtime-backed |
| `/console/snapshots` | `Restore` | restore snapshot | API-backed restore; pending state shown | runtime-backed |
| `/console/overview` | quick links to architecture/guarantees/policies/runs | navigate to diagnostic areas | navigation only | informational navigation |
| `/spend/policies` | link to `/console/policies` | move to policy console | navigation only | informational navigation |
| `/runs/[runId]` | back link `/runs` | return to run index | navigation only | informational navigation |

Controls intentionally **not** classified as live actions:
- Static KPI/status chips on informational pages.
- Decorative status indicators that do not invoke APIs.
- Disabled “Pro” navigation items in `/app` shell.

## 5) Observed state coverage (A-I)

| State | Covered? | Evidence |
|---|---:|---|
| A. Authenticated + backend configured + reachable | partial | runtime logs from protected routes with successful API responses |
| B. Authenticated + backend configured + unreachable | source-inspected + prior degraded semantics | dependency handling present; can be reproduced by pointing `REQUIEM_API_URL` to dead host |
| C. Authenticated + backend missing | yes | banner + standby/degraded copy across protected routes |
| D. Authenticated + no data | yes | empty collections / missing run ID (`/runs/demo-run` 404) |
| E. Engine/runtime unavailable | yes | degraded diagnostics/CAS/runtime routes when API checks fail |
| F. Forbidden/unauthorized | source-inspected | auth/authz error envelopes in middleware + API helpers |
| G. Unauthenticated redirect/sign-in | source-inspected | middleware protected-prefix redirect logic |
| H. Dev verify mode active | yes | screenshot-visible synthetic-auth banner on protected shells |
| I. Real auth mode active | source-inspected | verify mode off path requires Supabase user session |

## 6) Screenshot evidence index

All captures use **dev verify mode** and include the synthetic-auth warning banner.

- `/app*`: `app.png`, `app__executions.png`, `app__semantic-ledger.png`, `app__replay.png`, `app__cas.png`, `app__policy.png`, `app__audit.png`, `app__metrics.png`, `app__diagnostics.png`, `app__tenants.png`, `app__interop.png`
- `/console*`: `console.png`, `console__overview.png`, `console__architecture.png`, `console__guarantees.png`, `console__runs.png`, `console__policies.png`, `console__plans.png`, `console__capabilities.png`, `console__finops.png`, `console__logs.png`, `console__objects.png`, `console__decisions.png`, `console__replication.png`, `console__snapshots.png`
- `/intelligence*`: `intelligence__calibration.png`, `intelligence__calibration__factual.png`, `intelligence__verification.png`, `intelligence__cases.png`, `intelligence__signals.png`, `intelligence__learning.png`, `intelligence__foundry.png`, `intelligence__foundry__demo-dataset.png`, `intelligence__foundry__runs__demo-run.png`
- `/runs*`: `runs.png`, `runs__demo-run.png`
- `/registry*`: `registry.png`, `registry__demo-pkg.png`
- `/drift*`: `drift.png`, `drift__latency.png`
- `/spend*`: `spend.png`, `spend__policies.png`
- `/settings`: `settings.png`

## 7) Local validation procedure

### Unauthenticated flow
1. Start app without verify mode.
2. Visit protected route (`/console/overview`); expect redirect to `/auth/signin`.

### Dev verify mode flow
```bash
PORT=3005 REQUIEM_ROUTE_VERIFY_MODE=1 REQUIEM_ROUTE_VERIFY_TENANT=ux-evidence pnpm --filter ready-layer dev
```
Open any protected route and verify synthetic-auth warning banner is visible.

### Missing backend flow
```bash
PORT=3005 REQUIEM_ROUTE_VERIFY_MODE=1 pnpm --filter ready-layer dev
```
(leave `REQUIEM_API_URL` unset) and verify “Backend not configured” banner state.

### Unreachable backend flow
```bash
PORT=3005 REQUIEM_ROUTE_VERIFY_MODE=1 REQUIEM_API_URL=http://127.0.0.1:65535 pnpm --filter ready-layer dev
```
Visit runtime-backed routes (`/app/diagnostics`, `/console/runs`, `/spend`) and verify degraded/error states.

### Representative no-data flow
- Visit `/runs/demo-run` and verify truthful missing-run state (404/no record behavior).

## 8) Residual risk (explicit)

- Some route capability claims are source-inspected but not fully runtime-proven against a production-like Supabase auth + live backend in this environment.
- Informational pages still carry static sample/status content by design; they are classified as informational to avoid operational overclaim.
- Route maturity coverage is incomplete for some protected prefixes (for example `/intelligence/*`); those screens now show a source-inspected warning until cataloged.
