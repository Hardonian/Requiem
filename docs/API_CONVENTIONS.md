# API Conventions

> **Target:** Predictable, observable, and resilient machine-to-machine communication.

Requiem and ReadyLayer follow strict conventions for all API communication to ensure reliability and ease of integration.

---

## 1. Error Responses (Problem+JSON)

We use [RFC 7807 (Problem Details for HTTP APIs)](https://tools.ietf.org/html/rfc7807) for all error responses. Every error is returned as a structured JSON envelope.

**Example Error Response:**
```json
{
  "type": "https://ready-layer.com/errors/E_POL_VIOLATION",
  "title": "Policy Violation",
  "status": 403,
  "detail": "Tool 'system:delete_all' is not authorized for tenant 'guest'.",
  "instance": "req:trace:v1:7a8b9c..."
}
```

### Core Error Categories
- **`E_CFG_*`**: Configuration errors.
- **`E_POL_*`**: Policy and quota violations.
- **`E_INT_*`**: Invariant and determinism failures.
- **`E_NET_*`**: Network and timeout issues.

See [errors.md](./errors.md) for the full code registry.

---

## 2. Distributed Tracing

Every request **must** carry tracing headers. If they are missing, the gateway will generate them, but context will be lost.

- **`x-trace-id`**: The global unique ID for the operation chain.
- **`x-correlation-id`**: Links requests across service boundaries.
- **`x-tenant-id`**: Provided by the auth layer after JWT validation.

---

## 3. Idempotency

All write operations (`POST`, `PUT`, `DELETE`) support idempotency keys to prevent duplicate execution in case of network retry.

```http
POST /api/v1/plans
x-idempotency-key: job-12345
```

If a request with the same key is received within 24 hours, the system will return the cached `receipt_hash` instead of re-executing.

---

## 4. Rate Limiting & Budgets

We enforce rate limits at multiple levels:
- **Global**: Per-IP limits to prevent DOS.
- **Tenant**: Token-bucket limits based on the tenant's tier.
- **Model**: Specific limits for external LLM providers.

When limited, the API returns `429 Too Many Requests` with a `Retry-After` header.

---

## 5. Metadata Propagation

When invoking tools through the MCP (Model Context Protocol) transport, the system automatically injects execution context:
- `worker_id`
- `sandbox_mode`
- `budget_remaining`

Tools should use this metadata to adjust their behavior (e.g., returning partial results if the budget is low).
