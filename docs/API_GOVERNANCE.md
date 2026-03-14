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
