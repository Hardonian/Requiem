# API Surface

## API_SURFACE_MAP

| Path | Methods | Source | Registered | OpenAPI | Auth | Tenancy | Validation | Tests | SDK |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/agents | GET | ready-layer/src/app/api/agents/route.ts | no | no | protected | global | manual-or-none | not-detected | none |
| /api/audit/logs | GET | ready-layer/src/app/api/audit/logs/route.ts | yes | no | protected | tenant-scoped | schema-validated | not-detected | none |
| /api/budgets | GET, POST | ready-layer/src/app/api/budgets/route.ts | no | yes | protected | tenant-scoped | schema-validated | covered | openapi |
| /api/caps | GET, POST | ready-layer/src/app/api/caps/route.ts | no | no | protected | tenant-scoped | schema-validated | covered | none |
| /api/cas/integrity | GET | ready-layer/src/app/api/cas/integrity/route.ts | yes | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/cluster/drift | GET | ready-layer/src/app/api/cluster/drift/route.ts | yes | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/cluster/status | GET | ready-layer/src/app/api/cluster/status/route.ts | yes | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/cluster/workers | GET | ready-layer/src/app/api/cluster/workers/route.ts | yes | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/control-plane/insights | GET | ready-layer/src/app/api/control-plane/insights/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/decisions | GET | ready-layer/src/app/api/decisions/route.ts | no | no | protected | global | manual-or-none | not-detected | none |
| /api/drift | GET, POST | ready-layer/src/app/api/drift/route.ts | no | no | protected | tenant-scoped | schema-validated | covered | none |
| /api/engine/analyze | GET | ready-layer/src/app/api/engine/analyze/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/engine/autotune | GET, POST | ready-layer/src/app/api/engine/autotune/route.ts | no | no | protected | tenant-scoped | schema-validated | not-detected | none |
| /api/engine/diagnostics | GET | ready-layer/src/app/api/engine/diagnostics/route.ts | yes | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/engine/metrics | GET | ready-layer/src/app/api/engine/metrics/route.ts | yes | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/engine/status | GET | ready-layer/src/app/api/engine/status/route.ts | yes | yes | protected | tenant-scoped | manual-or-none | covered | openapi |
| /api/failures/analytics | GET | ready-layer/src/app/api/failures/analytics/route.ts | no | no | protected | global | manual-or-none | not-detected | none |
| /api/foundry/artifacts | GET | ready-layer/src/app/api/foundry/artifacts/route.ts | no | no | protected | global | manual-or-none | not-detected | none |
| /api/foundry/artifacts/[id] | GET, DELETE | ready-layer/src/app/api/foundry/artifacts/[id]/route.ts | no | no | protected | global | manual-or-none | not-detected | none |
| /api/foundry/datasets | GET, POST | ready-layer/src/app/api/foundry/datasets/route.ts | no | no | protected | tenant-scoped | schema-validated | not-detected | none |
| /api/foundry/datasets/[id] | GET, PATCH, DELETE, POST | ready-layer/src/app/api/foundry/datasets/[id]/route.ts | no | no | protected | global | schema-validated | not-detected | none |
| /api/foundry/generators | GET, POST | ready-layer/src/app/api/foundry/generators/route.ts | no | no | protected | global | schema-validated | not-detected | none |
| /api/foundry/runs | GET, POST | ready-layer/src/app/api/foundry/runs/route.ts | no | no | protected | global | schema-validated | not-detected | none |
| /api/foundry/runs/[id] | GET, PATCH, POST | ready-layer/src/app/api/foundry/runs/[id]/route.ts | no | no | protected | global | schema-validated | not-detected | none |
| /api/health | GET | ready-layer/src/app/api/health/route.ts | yes | yes | public | global | manual-or-none | covered | openapi |
| /api/intelligence/calibration | GET | ready-layer/src/app/api/intelligence/calibration/route.ts | no | no | protected | tenant-scoped | schema-validated | covered | none |
| /api/intelligence/calibration/[claim_type] | GET | ready-layer/src/app/api/intelligence/calibration/[claim_type]/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/intelligence/cases | GET | ready-layer/src/app/api/intelligence/cases/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/intelligence/outcomes | GET | ready-layer/src/app/api/intelligence/outcomes/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/intelligence/predictions | GET | ready-layer/src/app/api/intelligence/predictions/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/intelligence/signals | GET | ready-layer/src/app/api/intelligence/signals/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/learning/calibrate | POST | ready-layer/src/app/api/learning/calibrate/route.ts | no | no | protected | tenant-scoped | schema-validated | not-detected | none |
| /api/learning/crosstabs | GET, POST | ready-layer/src/app/api/learning/crosstabs/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/learning/dashboard | GET | ready-layer/src/app/api/learning/dashboard/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/learning/error-bands | GET, POST | ready-layer/src/app/api/learning/error-bands/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/learning/outcomes | POST | ready-layer/src/app/api/learning/outcomes/route.ts | no | no | protected | tenant-scoped | schema-validated | not-detected | none |
| /api/learning/train | POST | ready-layer/src/app/api/learning/train/route.ts | no | no | protected | tenant-scoped | schema-validated | not-detected | none |
| /api/logs | GET | ready-layer/src/app/api/logs/route.ts | no | no | protected | tenant-scoped | schema-validated | covered | none |
| /api/mcp/health | GET | ready-layer/src/app/api/mcp/health/route.ts | yes | no | protected | global | manual-or-none | covered | none |
| /api/mcp/tool/call | POST | ready-layer/src/app/api/mcp/tool/call/route.ts | yes | no | protected | global | manual-or-none | covered | none |
| /api/mcp/tools | GET | ready-layer/src/app/api/mcp/tools/route.ts | yes | no | protected | global | manual-or-none | covered | none |
| /api/objects | GET, HEAD | ready-layer/src/app/api/objects/route.ts | no | no | protected | global | schema-validated | not-detected | none |
| /api/openapi.json | GET | ready-layer/src/app/api/openapi.json/route.ts | no | no | public | global | manual-or-none | covered | none |
| /api/plans | GET, POST | ready-layer/src/app/api/plans/route.ts | no | no | protected | global | schema-validated | covered | none |
| /api/policies | GET, POST | ready-layer/src/app/api/policies/route.ts | no | no | protected | global | schema-validated | covered | none |
| /api/policies/simulate | POST | ready-layer/src/app/api/policies/simulate/route.ts | no | no | protected | global | schema-validated | not-detected | none |
| /api/registry | GET, POST | ready-layer/src/app/api/registry/route.ts | no | no | protected | tenant-scoped | schema-validated | not-detected | none |
| /api/replay/lab | GET | ready-layer/src/app/api/replay/lab/route.ts | no | no | protected | global | schema-validated | not-detected | none |
| /api/replay/verify | GET | ready-layer/src/app/api/replay/verify/route.ts | no | no | protected | tenant-scoped | schema-validated | not-detected | none |
| /api/routes-probe | GET, POST | ready-layer/src/app/api/routes-probe/route.ts | no | no | public | global | manual-or-none | not-detected | none |
| /api/runs | GET | ready-layer/src/app/api/runs/route.ts | no | no | protected | tenant-scoped | manual-or-none | covered | none |
| /api/runs/[runId]/diff | GET | ready-layer/src/app/api/runs/[runId]/diff/route.ts | no | no | protected | global | manual-or-none | not-detected | none |
| /api/snapshots | GET, POST | ready-layer/src/app/api/snapshots/route.ts | no | no | protected | global | schema-validated | covered | none |
| /api/spend | GET, POST | ready-layer/src/app/api/spend/route.ts | no | no | protected | tenant-scoped | schema-validated | not-detected | none |
| /api/status | GET | ready-layer/src/app/api/status/route.ts | no | no | protected | global | manual-or-none | not-detected | none |
| /api/tenants/isolation | GET | ready-layer/src/app/api/tenants/isolation/route.ts | no | no | protected | tenant-scoped | manual-or-none | not-detected | none |
| /api/trust-graph | GET | ready-layer/src/app/api/trust-graph/route.ts | no | no | protected | global | schema-validated | not-detected | none |
| /api/vector/search | POST, GET | ready-layer/src/app/api/vector/search/route.ts | no | yes | public | tenant-scoped | schema-validated | covered | openapi |

## UNREGISTERED_OR_UNMAPPED_ROUTE_LIST
- /api/agents GET
- /api/budgets GET
- /api/budgets POST
- /api/caps GET
- /api/caps POST
- /api/control-plane/insights GET
- /api/decisions GET
- /api/drift GET
- /api/drift POST
- /api/engine/analyze GET
- /api/engine/autotune GET
- /api/failures/analytics GET
- /api/foundry/artifacts GET
- /api/foundry/artifacts/[id] GET
- /api/foundry/artifacts/[id] DELETE
- /api/foundry/datasets GET
- /api/foundry/datasets POST
- /api/foundry/datasets/[id] GET
- /api/foundry/datasets/[id] PATCH
- /api/foundry/datasets/[id] DELETE
- /api/foundry/datasets/[id] POST
- /api/foundry/generators GET
- /api/foundry/generators POST
- /api/foundry/runs GET
- /api/foundry/runs POST
- /api/foundry/runs/[id] GET
- /api/foundry/runs/[id] PATCH
- /api/foundry/runs/[id] POST
- /api/intelligence/calibration GET
- /api/intelligence/calibration/[claim_type] GET
- /api/intelligence/cases GET
- /api/intelligence/outcomes GET
- /api/intelligence/predictions GET
- /api/intelligence/signals GET
- /api/learning/calibrate POST
- /api/learning/crosstabs GET
- /api/learning/crosstabs POST
- /api/learning/dashboard GET
- /api/learning/error-bands GET
- /api/learning/error-bands POST
- /api/learning/outcomes POST
- /api/learning/train POST
- /api/logs GET
- /api/objects GET
- /api/objects HEAD
- /api/openapi.json GET
- /api/plans GET
- /api/plans POST
- /api/policies GET
- /api/policies POST
- /api/policies/simulate POST
- /api/registry GET
- /api/registry POST
- /api/replay/lab GET
- /api/replay/verify GET
- /api/routes-probe GET
- /api/routes-probe POST
- /api/runs GET
- /api/runs/[runId]/diff GET
- /api/snapshots GET
- /api/snapshots POST
- /api/spend GET
- /api/spend POST
- /api/status GET
- /api/tenants/isolation GET
- /api/trust-graph GET
- /api/vector/search GET

## DEAD_OR_DUPLICATE_ROUTE_LIST
### Duplicate route ids
- none
### Manifest entries without handler
- /api/engine/analyze#POST
- /api/replay/verify#POST
