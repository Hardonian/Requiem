# Operator Runbook (API Failures)

## Triage using trace IDs

1. Capture `x-trace-id` and `x-request-id` from client response headers.
2. Search API logs for `trace_id`.
3. Correlate with `api.request.failed` structured log entries.

## Common failure classes

- `auth_secret_required`: strict mode running without `REQUIEM_AUTH_SECRET`
- `missing_tenant_id`: protected route called without `x-tenant-id`
- `MCP_INIT_FAILED`: MCP bootstrap unavailable

## Mode expectations

- Local OSS mode can run without private services.
- Production-like mode must provide auth and tenant context.
