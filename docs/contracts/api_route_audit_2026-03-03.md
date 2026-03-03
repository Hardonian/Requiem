# API Route and Middleware Audit (2026-03-03)

## Middleware Order

1. `ready-layer/src/middleware/proxy.ts`
- static/public bypass
- trace id injection
- Supabase session auth for protected routes
- tenant/user propagation via request headers (`x-tenant-id`, `x-user-id`, `x-requiem-authenticated`)
- Problem+JSON responses for API auth/middleware failures

2. Route wrapper `ready-layer/src/lib/big4-http.ts::withTenantContext`
- auth extraction and tenant context assembly
- token-bucket rate limiting
- optional GET response cache
- optional POST/PUT idempotency replay/conflict protection
- policy gate hook
- consistent trace/request headers
- safe exception-to-Problem+JSON conversion
- structured logs

## Route Groups

Tenant-scoped protected routes:
- `/api/budgets`, `/api/caps`, `/api/logs`, `/api/objects`, `/api/plans`, `/api/policies`, `/api/snapshots`
- `/api/runs`, `/api/runs/[runId]/diff`, `/api/drift`, `/api/spend`, `/api/registry`
- `/api/engine/*`, `/api/cluster/*`, `/api/cas/integrity`, `/api/replay/verify`, `/api/audit/logs`
- `/api/foundry/*`, `/api/intelligence/*`, `/api/vector/search` (POST)

Public routes:
- `/api/health`
- `/api/openapi.json`
- `/api/vector/search` (GET metadata)
- `/api/routes-probe` (explicitly public for verification harness)

MCP bridge routes:
- `/api/mcp/health`
- `/api/mcp/tools`
- `/api/mcp/tool/call`

## Error Handling State

Standardized:
- wrapper and middleware errors now emit Problem+JSON + trace id
- auth denials emit Problem+JSON
- validation failures emit Problem+JSON

Residual custom format (kept for compatibility):
- MCP degraded payloads retain `ok/code/message/error`, now augmented as Problem+JSON

## Tenant Extraction

Derived from:
- trusted middleware-provided auth headers (`x-requiem-authenticated`, `x-tenant-id`)
- or bearer token flow (`Authorization`)

Never authoritative:
- `tenant_id` in request body/query
