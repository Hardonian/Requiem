# ReadyLayer API Conventions

This document defines API-layer behavior for `ready-layer/src/app/api/*`.

## 1. Error Envelope

All 4xx/5xx responses use `application/problem+json` with:

```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Request validation failed",
  "trace_id": "...",
  "code": "validation_error"
}
```

Rules:
- `trace_id` is always present.
- Unexpected exceptions are converted to safe Problem+JSON responses.
- No route should emit raw stack traces.

## 2. Tracing and Logging

Request tracing:
- Incoming `x-trace-id` is propagated when present.
- Otherwise trace id is derived from `traceparent` or generated.
- Responses include `x-trace-id` and `x-request-id`.

Structured logs include:
- route id
- method
- status
- tenant id
- actor id
- trace id
- request id
- duration

## 3. Tenant Isolation

Rules:
- Tenant identity is derived from auth context (`Authorization` or trusted middleware headers).
- `tenant_id` from body/query is never authoritative.
- All tenant-sensitive routes require auth by default.

## 4. Validation

- Query/body validation uses `zod`.
- Validation failures produce Problem+JSON with `code=validation_error`.
- Invalid JSON returns Problem+JSON with `code=invalid_json`.

## 5. Rate Limiting

- Token bucket limiter is enforced per `tenant + actor + route`.
- Exceeded limits return 429 Problem+JSON and `retry-after` header.

## 6. Idempotency

For mutating routes that enable idempotency:
- Use `Idempotency-Key` header.
- Same key + same body replay previous response.
- Same key + different body returns 409 Problem+JSON.

## 7. Caching

Safe GET routes may enable server cache with TTL.
- Responses set `Cache-Control`.
- Cache hits set `x-cache-hit: 1`.

## 8. OpenAPI

OpenAPI spec endpoint:
- `GET /api/openapi.json`

The spec includes:
- shared Problem schema
- auth and idempotency header parameters
- route examples and error responses

## 9. Curl Examples

```bash
curl -sS http://localhost:3000/api/health
```

```bash
curl -sS \
  -H 'authorization: Bearer dev-token' \
  -H 'x-tenant-id: tenant-a' \
  http://localhost:3000/api/engine/status
```

```bash
curl -sS -X POST \
  -H 'authorization: Bearer dev-token' \
  -H 'x-tenant-id: tenant-a' \
  -H 'idempotency-key: budget-1' \
  -H 'content-type: application/json' \
  -d '{"action":"set","unit":"exec","limit":100}' \
  http://localhost:3000/api/budgets
```
