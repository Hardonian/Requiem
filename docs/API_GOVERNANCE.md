# API Governance

## Route classes

- **Public probe routes**: `/api/health`, `/api/status`, `/api/openapi.json`, `/api/mcp/health`
- **Protected tenant routes**: all other `/api/**` endpoints
- **Explicit wrapper exceptions**: MCP delegation routes and `/api/status`

## Required route conformance

Protected routes MUST:
1. use `withTenantContext` from `@/lib/big4-http`
2. return problem+json on error
3. include `x-trace-id` and `x-request-id`
4. enforce tenant context from `x-tenant-id`

## Enforcement

- `scripts/verify-routes.ts`
  - fails on manifest drift (`routes.manifest.json` vs filesystem)
  - fails if non-exempt API routes bypass `withTenantContext`
- `scripts/verify-problem-json.ts`
- `scripts/verify-tenant-body.ts`
- `scripts/verify-routes-runtime.ts`

## Manifest source of truth

`routes.manifest.json` is generated via `scripts/generate-routes-manifest.ts`.
Manual editing is not allowed.
Route class policy:
- public: requireAuth false on withTenantContext wrapper
- protected: default auth required
- tenant-scoped: tenant id consumed in handler context
- global: no tenant input consumed

## TEST_COVERAGE_MATRIX

| Surface | Current | Missing | Recommended | Priority |
| --- | --- | --- | --- | --- |
| /api/agents [GET] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/audit/logs [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/budgets [GET,POST] | route tests detected | deeper regression optional | integration + contract | high |
| /api/caps [GET,POST] | route tests detected | deeper regression optional | integration + contract | high |
| /api/cas/integrity [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/cluster/drift [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/cluster/status [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/cluster/workers [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/control-plane/insights [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/decisions [GET] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/drift [GET,POST] | route tests detected | deeper regression optional | integration + contract | high |
| /api/engine/analyze [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/engine/autotune [GET,POST] | none detected | auth/validation contract tests | integration + contract | high |
| /api/engine/diagnostics [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/engine/metrics [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/engine/status [GET] | route tests detected | deeper regression optional | integration + contract | high |
| /api/failures/analytics [GET] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/foundry/artifacts [GET] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/foundry/artifacts/[id] [GET,DELETE] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/foundry/datasets [GET,POST] | none detected | auth/validation contract tests | integration + contract | high |
| /api/foundry/datasets/[id] [GET,PATCH,DELETE,POST] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/foundry/generators [GET,POST] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/foundry/runs [GET,POST] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/foundry/runs/[id] [GET,PATCH,POST] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/health [GET] | route tests detected | deeper regression optional | smoke + contract | high |
| /api/intelligence/calibration [GET] | route tests detected | deeper regression optional | integration + contract | high |
| /api/intelligence/calibration/[claim_type] [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/intelligence/cases [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/intelligence/outcomes [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/intelligence/predictions [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/intelligence/signals [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/learning/calibrate [POST] | none detected | auth/validation contract tests | integration + contract | high |
| /api/learning/crosstabs [GET,POST] | none detected | auth/validation contract tests | integration + contract | high |
| /api/learning/dashboard [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/learning/error-bands [GET,POST] | none detected | auth/validation contract tests | integration + contract | high |
| /api/learning/outcomes [POST] | none detected | auth/validation contract tests | integration + contract | high |
| /api/learning/train [POST] | none detected | auth/validation contract tests | integration + contract | high |
| /api/logs [GET] | route tests detected | deeper regression optional | integration + contract | high |
| /api/mcp/health [GET] | route tests detected | deeper regression optional | integration + contract | medium |
| /api/mcp/tool/call [POST] | route tests detected | deeper regression optional | integration + contract | medium |
| /api/mcp/tools [GET] | route tests detected | deeper regression optional | integration + contract | medium |
| /api/objects [GET,HEAD] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/openapi.json [GET] | route tests detected | deeper regression optional | smoke + contract | high |
| /api/plans [GET,POST] | route tests detected | deeper regression optional | integration + contract | medium |
| /api/policies [GET,POST] | route tests detected | deeper regression optional | integration + contract | medium |
| /api/policies/simulate [POST] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/registry [GET,POST] | none detected | auth/validation contract tests | integration + contract | high |
| /api/replay/lab [GET] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/replay/verify [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/routes-probe [GET,POST] | none detected | auth/validation contract tests | smoke + contract | high |
| /api/runs [GET] | route tests detected | deeper regression optional | integration + contract | high |
| /api/runs/[runId]/diff [GET] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/snapshots [GET,POST] | route tests detected | deeper regression optional | integration + contract | medium |
| /api/spend [GET,POST] | none detected | auth/validation contract tests | integration + contract | high |
| /api/status [GET] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/tenants/isolation [GET] | none detected | auth/validation contract tests | integration + contract | high |
| /api/trust-graph [GET] | none detected | auth/validation contract tests | integration + contract | medium |
| /api/vector/search [POST,GET] | route tests detected | deeper regression optional | smoke + contract | high |

## SDK_SURFACE_MAP
- sdk/typescript, sdk/python, sdk/go are README placeholders only; no generated client code exists.

## Load/performance decision
- Existing verify-routes-runtime script already performs bounded burst calls against /api/runs and checks 429 contracts.
- No additional load harness added in this pass.
