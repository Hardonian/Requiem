# Route Truth Matrix

Generated: 2026-03-14T05:03:39.003Z

- Total routes: **127**
- Page routes: **69**
- API routes: **58**
- Dynamic param routes: **12**

| Route | Kind | Bucket | Dynamic Params | Render Mode | Loading | Error Boundary | Not Found Boundary | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | page | marketing/static | no | static-or-isr | no | yes | yes | `ready-layer/src/app/page.tsx` |
| `/api/agents` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/agents/route.ts` |
| `/api/audit/logs` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/audit/logs/route.ts` |
| `/api/budgets` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/budgets/route.ts` |
| `/api/caps` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/caps/route.ts` |
| `/api/cas/integrity` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/cas/integrity/route.ts` |
| `/api/cluster/drift` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/cluster/drift/route.ts` |
| `/api/cluster/status` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/cluster/status/route.ts` |
| `/api/cluster/workers` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/cluster/workers/route.ts` |
| `/api/control-plane/insights` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/control-plane/insights/route.ts` |
| `/api/decisions` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/decisions/route.ts` |
| `/api/drift` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/drift/route.ts` |
| `/api/engine/analyze` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/engine/analyze/route.ts` |
| `/api/engine/autotune` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/engine/autotune/route.ts` |
| `/api/engine/diagnostics` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/engine/diagnostics/route.ts` |
| `/api/engine/metrics` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/engine/metrics/route.ts` |
| `/api/engine/status` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/engine/status/route.ts` |
| `/api/failures/analytics` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/failures/analytics/route.ts` |
| `/api/foundry/artifacts` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/foundry/artifacts/route.ts` |
| `/api/foundry/artifacts/[id]` | api | api/internal | yes | dynamic | no | no | no | `ready-layer/src/app/api/foundry/artifacts/[id]/route.ts` |
| `/api/foundry/datasets` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/foundry/datasets/route.ts` |
| `/api/foundry/datasets/[id]` | api | api/internal | yes | dynamic | no | no | no | `ready-layer/src/app/api/foundry/datasets/[id]/route.ts` |
| `/api/foundry/generators` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/foundry/generators/route.ts` |
| `/api/foundry/runs` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/foundry/runs/route.ts` |
| `/api/foundry/runs/[id]` | api | api/internal | yes | dynamic | no | no | no | `ready-layer/src/app/api/foundry/runs/[id]/route.ts` |
| `/api/health` | api | api/health/status | no | dynamic | no | no | no | `ready-layer/src/app/api/health/route.ts` |
| `/api/intelligence/calibration` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/intelligence/calibration/route.ts` |
| `/api/intelligence/calibration/[claim_type]` | api | api/internal | yes | dynamic | no | no | no | `ready-layer/src/app/api/intelligence/calibration/[claim_type]/route.ts` |
| `/api/intelligence/cases` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/intelligence/cases/route.ts` |
| `/api/intelligence/outcomes` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/intelligence/outcomes/route.ts` |
| `/api/intelligence/predictions` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/intelligence/predictions/route.ts` |
| `/api/intelligence/signals` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/intelligence/signals/route.ts` |
| `/api/learning/calibrate` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/learning/calibrate/route.ts` |
| `/api/learning/crosstabs` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/learning/crosstabs/route.ts` |
| `/api/learning/dashboard` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/learning/dashboard/route.ts` |
| `/api/learning/error-bands` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/learning/error-bands/route.ts` |
| `/api/learning/outcomes` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/learning/outcomes/route.ts` |
| `/api/learning/train` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/learning/train/route.ts` |
| `/api/logs` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/logs/route.ts` |
| `/api/mcp/health` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/mcp/health/route.ts` |
| `/api/mcp/tool/call` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/mcp/tool/call/route.ts` |
| `/api/mcp/tools` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/mcp/tools/route.ts` |
| `/api/objects` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/objects/route.ts` |
| `/api/openapi.json` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/openapi.json/route.ts` |
| `/api/plans` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/plans/route.ts` |
| `/api/policies` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/policies/route.ts` |
| `/api/policies/simulate` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/policies/simulate/route.ts` |
| `/api/registry` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/registry/route.ts` |
| `/api/replay/lab` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/replay/lab/route.ts` |
| `/api/replay/verify` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/replay/verify/route.ts` |
| `/api/routes-probe` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/routes-probe/route.ts` |
| `/api/runs` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/runs/route.ts` |
| `/api/runs/[runId]/diff` | api | api/internal | yes | dynamic | no | no | no | `ready-layer/src/app/api/runs/[runId]/diff/route.ts` |
| `/api/snapshots` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/snapshots/route.ts` |
| `/api/spend` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/spend/route.ts` |
| `/api/status` | api | api/health/status | no | dynamic | no | no | no | `ready-layer/src/app/api/status/route.ts` |
| `/api/tenants/isolation` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/tenants/isolation/route.ts` |
| `/api/trust-graph` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/trust-graph/route.ts` |
| `/api/vector/search` | api | api/internal | no | dynamic | no | no | no | `ready-layer/src/app/api/vector/search/route.ts` |
| `/app` | page | app/dashboard | no | static-or-isr | no | yes | no | `ready-layer/src/app/app/page.tsx` |
| `/app/audit` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/audit/page.tsx` |
| `/app/cas` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/cas/page.tsx` |
| `/app/diagnostics` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/diagnostics/page.tsx` |
| `/app/executions` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/executions/page.tsx` |
| `/app/interop` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/interop/page.tsx` |
| `/app/metrics` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/metrics/page.tsx` |
| `/app/policy` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/policy/page.tsx` |
| `/app/replay` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/replay/page.tsx` |
| `/app/semantic-ledger` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/semantic-ledger/page.tsx` |
| `/app/tenants` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/app/tenants/page.tsx` |
| `/auth/callback` | page | auth/account | no | static-or-isr | no | no | no | `ready-layer/src/app/auth/callback/page.tsx` |
| `/auth/reset-password` | page | auth/account | no | static-or-isr | no | no | no | `ready-layer/src/app/auth/reset-password/page.tsx` |
| `/auth/signin` | page | auth/account | no | static-or-isr | no | no | no | `ready-layer/src/app/auth/signin/page.tsx` |
| `/auth/signup` | page | auth/account | no | static-or-isr | no | no | no | `ready-layer/src/app/auth/signup/page.tsx` |
| `/changelog` | page | docs/help | no | static-or-isr | no | no | no | `ready-layer/src/app/changelog/page.tsx` |
| `/console` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/page.tsx` |
| `/console/architecture` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/architecture/page.tsx` |
| `/console/capabilities` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/capabilities/page.tsx` |
| `/console/decisions` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/decisions/page.tsx` |
| `/console/finops` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/finops/page.tsx` |
| `/console/guarantees` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/guarantees/page.tsx` |
| `/console/logs` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/logs/page.tsx` |
| `/console/objects` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/objects/page.tsx` |
| `/console/overview` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/overview/page.tsx` |
| `/console/plans` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/plans/page.tsx` |
| `/console/policies` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/policies/page.tsx` |
| `/console/replication` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/replication/page.tsx` |
| `/console/runs` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/runs/page.tsx` |
| `/console/snapshots` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/console/snapshots/page.tsx` |
| `/demo` | page | playground/demo | no | static-or-isr | no | no | no | `ready-layer/src/app/demo/page.tsx` |
| `/docs` | page | docs/help | no | static-or-isr | no | no | no | `ready-layer/src/app/docs/page.tsx` |
| `/documentation` | page | docs/help | no | static-or-isr | no | no | no | `ready-layer/src/app/documentation/page.tsx` |
| `/drift` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/drift/page.tsx` |
| `/drift/[vector]` | page | dynamic entity route | yes | static-or-isr | no | no | no | `ready-layer/src/app/drift/[vector]/page.tsx` |
| `/enterprise` | page | marketing/static | no | static-or-isr | no | no | no | `ready-layer/src/app/enterprise/page.tsx` |
| `/enterprise/request-demo` | page | marketing/static | no | static-or-isr | no | no | no | `ready-layer/src/app/enterprise/request-demo/page.tsx` |
| `/features` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/features/page.tsx` |
| `/intelligence/calibration` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/intelligence/calibration/page.tsx` |
| `/intelligence/calibration/[claim_type]` | page | dynamic entity route | yes | static-or-isr | no | no | no | `ready-layer/src/app/intelligence/calibration/[claim_type]/page.tsx` |
| `/intelligence/cases` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/intelligence/cases/page.tsx` |
| `/intelligence/foundry` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/intelligence/foundry/page.tsx` |
| `/intelligence/foundry/[datasetId]` | page | dynamic entity route | yes | static-or-isr | no | no | no | `ready-layer/src/app/intelligence/foundry/[datasetId]/page.tsx` |
| `/intelligence/foundry/runs/[datasetRunId]` | page | dynamic entity route | yes | static-or-isr | no | no | no | `ready-layer/src/app/intelligence/foundry/runs/[datasetRunId]/page.tsx` |
| `/intelligence/learning` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/intelligence/learning/page.tsx` |
| `/intelligence/signals` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/intelligence/signals/page.tsx` |
| `/intelligence/verification` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/intelligence/verification/page.tsx` |
| `/library` | page | docs/help | no | static-or-isr | no | no | no | `ready-layer/src/app/library/page.tsx` |
| `/login` | page | auth/account | no | static-or-isr | no | no | no | `ready-layer/src/app/login/page.tsx` |
| `/pricing` | page | marketing/static | no | static-or-isr | no | no | no | `ready-layer/src/app/pricing/page.tsx` |
| `/privacy` | page | marketing/static | no | static-or-isr | no | no | no | `ready-layer/src/app/privacy/page.tsx` |
| `/proof/diff/[token]` | page | playground/demo | yes | static-or-isr | no | no | no | `ready-layer/src/app/proof/diff/[token]/page.tsx` |
| `/registry` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/registry/page.tsx` |
| `/registry/[pkg]` | page | dynamic entity route | yes | static-or-isr | no | no | no | `ready-layer/src/app/registry/[pkg]/page.tsx` |
| `/runs` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/runs/page.tsx` |
| `/runs/[runId]` | page | dynamic entity route | yes | static-or-isr | no | no | no | `ready-layer/src/app/runs/[runId]/page.tsx` |
| `/security` | page | marketing/static | no | static-or-isr | no | no | no | `ready-layer/src/app/security/page.tsx` |
| `/settings` | page | app/dashboard | no | static-or-isr | no | no | no | `ready-layer/src/app/settings/page.tsx` |
| `/signup` | page | auth/account | no | static-or-isr | no | no | no | `ready-layer/src/app/signup/page.tsx` |
| `/spend` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/spend/page.tsx` |
| `/spend/policies` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/spend/policies/page.tsx` |
| `/status` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/status/page.tsx` |
| `/support` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/support/page.tsx` |
| `/support/contact` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/support/contact/page.tsx` |
| `/support/status` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/support/status/page.tsx` |
| `/templates` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/templates/page.tsx` |
| `/terms` | page | marketing/static | no | static-or-isr | no | no | no | `ready-layer/src/app/terms/page.tsx` |
| `/transparency` | page | other | no | static-or-isr | no | no | no | `ready-layer/src/app/transparency/page.tsx` |
