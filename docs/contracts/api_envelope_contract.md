# Requiem API Envelope Contract

> **Status:** FROZEN — Contract stable for v1.x  
> **Last Updated:** 2026-03-02  
> **Enforcement:** CI fails on breaking changes

## Overview

All API responses (web and internal) MUST follow this envelope format. This ensures consistent error handling, observability, and client compatibility.

## Success Envelope

```json
{
  "ok": true,
  "data": <T>,
  "trace_id": string,
  "request_id": string | null,
  "timestamp": string (ISO 8601)
}
```

## Error Envelope

```json
{
  "ok": false,
  "error": {
    "code": string,
    "message": string,
    "hint": string | null
  },
  "trace_id": string,
  "request_id": string | null,
  "timestamp": string (ISO 8601)
}
```

## Field Specifications

### `ok` (required)

- Type: `boolean`
- `true` — Request succeeded, `data` field present
- `false` — Request failed, `error` field present

### `data` (required when `ok: true`)

- Type: Any valid JSON (object, array, string, number, boolean)
- Contains the successful response payload
- Schema depends on the specific endpoint

### `error` (required when `ok: false`)

- Type: `object`
- **Contract:** Error objects MUST NOT contain:
  - Stack traces (`stack`, `traceback` fields prohibited)
  - Internal file paths
  - Database connection strings
  - Secret values or tokens

#### Error Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | Yes | Machine-readable error code (snake_case) |
| `message` | `string` | Yes | Human-readable error description |
| `hint` | `string \| null` | Yes | Actionable suggestion for resolution |

### `trace_id` (required)

- Type: `string`
- Format: UUID v4 or 16+ character alphanumeric
- Purpose: Distributed tracing correlation
- **Contract:** Must be unique per request, propagated across service boundaries

### `request_id` (required, nullable)

- Type: `string \| null`
- Purpose: Echoes client's `X-Request-ID` header if provided
- **Contract:** If client provides request ID, it MUST be echoed back exactly

### `timestamp` (required)

- Type: `string`
- Format: ISO 8601 with timezone (e.g., `2026-03-02T21:53:31.302Z`)
- Purpose: Response generation time

## Error Code Registry

### Client Errors (4xx equivalent)

| Code | HTTP Status | Description | Hint |
|------|-------------|-------------|------|
| `bad_request` | 400 | Malformed request | Check request syntax and required fields |
| `unauthorized` | 401 | Authentication required | Provide valid capability token |
| `forbidden` | 403 | Insufficient permissions | Request additional capabilities |
| `not_found` | 404 | Resource not found | Verify identifier and try again |
| `conflict` | 409 | Resource already exists | Use different identifier or update existing |
| `payload_too_large` | 413 | Request body exceeds limit | Reduce payload size or use streaming |
| `validation_error` | 422 | Input validation failed | Check field constraints |
| `rate_limited` | 429 | Too many requests | Implement exponential backoff |
| `capability_expired` | 403 | Capability token expired | Mint new capability token |
| `capability_revoked` | 403 | Capability has been revoked | Request new capability from issuer |

### Server Errors (5xx equivalent)

| Code | HTTP Status | Description | Hint |
|------|-------------|-------------|------|
| `internal_error` | 500 | Unexpected server error | Retry with exponential backoff |
| `not_implemented` | 501 | Feature not available | Check API version or contact support |
| `service_unavailable` | 503 | Service temporarily unavailable | Retry after delay |
| `determinism_failed` | 503 | Could not ensure deterministic execution | Check environment configuration |
| `cas_corruption` | 500 | CAS integrity check failed | Contact administrator |
| `chain_broken` | 500 | Event log chain integrity failure | Contact administrator |
| `hash_unavailable` | 503 | BLAKE3 hash function unavailable | Check engine installation |

### Execution Errors

| Code | Description | Hint |
|------|-------------|------|
| `timeout` | Execution exceeded time limit | Increase timeout or optimize workload |
| `oom_killed` | Process exceeded memory limit | Increase memory limit or optimize |
| `sandbox_violation` | Attempted sandbox escape | Review workspace boundaries |
| `replay_mismatch` | Replay produced different result | Environment non-determinism detected |
| `drift_detected` | Deterministic drift in execution | Check environment variables |

## Pagination Schema

List endpoints returning multiple items use this envelope:

```json
{
  "ok": true,
  "data": {
    "items": [<T>],
    "pagination": {
      "page": number,
      "per_page": number,
      "total": number,
      "total_pages": number,
      "has_next": boolean,
      "has_prev": boolean,
      "cursor": string | null
    }
  },
  "trace_id": string,
  "request_id": string | null,
  "timestamp": string
}
```

### Pagination Fields

| Field | Type | Description |
|-------|------|-------------|
| `page` | `number` | Current page number (1-indexed) |
| `per_page` | `number` | Items per page |
| `total` | `number` | Total items across all pages |
| `total_pages` | `number` | Total number of pages |
| `has_next` | `boolean` | Whether more pages exist |
| `has_prev` | `boolean` | Whether previous pages exist |
| `cursor` | `string \| null` | Opaque cursor for cursor-based pagination |

### Pagination Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | 1 | Page to fetch |
| `per_page` | `number` | 20 | Items per page (max 100) |
| `cursor` | `string` | null | Cursor from previous response |

**Contract:** Either `page` OR `cursor` may be provided, not both. Providing both returns `validation_error`.

## Streaming Responses

For streaming endpoints (Server-Sent Events or NDJSON):

```json
{"type": "event", "data": <T>, "seq": number, "timestamp": string}
{"type": "error", "error": {...}, "seq": number, "timestamp": string}
{"type": "complete", "seq": number, "timestamp": string}
```

**Contract:** 
- Each line is a valid JSON object
- `seq` is monotonically increasing within the stream
- `type` is one of: `event`, `error`, `complete`
- Stream ends with `complete` or `error` message

## HTTP Status Codes

While the envelope contains detailed error information, HTTP status codes are used for transport-level semantics:

| Status | Usage |
|--------|-------|
| `200 OK` | Success with body |
| `201 Created` | Resource created successfully |
| `204 No Content` | Success, no body (delete operations) |
| `400 Bad Request` | Request malformed |
| `401 Unauthorized` | Missing or invalid auth |
| `403 Forbidden` | Auth valid but insufficient |
| `404 Not Found` | Resource doesn't exist |
| `409 Conflict` | Resource state conflict |
| `422 Unprocessable` | Validation failed |
| `429 Too Many Requests` | Rate limited |
| `500 Internal Error` | Server error |
| `503 Service Unavailable` | Service temporarily down |

**Contract:** HTTP status and `ok` field are consistent:
- `2xx` status → `ok: true`
- `4xx/5xx` status → `ok: false`

## Content-Type Headers

| Endpoint Type | Content-Type |
|---------------|--------------|
| JSON API | `application/json` |
| Streaming | `application/x-ndjson` or `text/event-stream` |
| Binary CAS | `application/octet-stream` |
| Health Check | `application/json` or plain text |

## Request Headers

Clients SHOULD send:

| Header | Description |
|--------|-------------|
| `Accept: application/json` | Expected response format |
| `X-Request-ID: <uuid>` | Request correlation ID |
| `X-Trace-Context: <trace_id>` | Distributed tracing context |
| `Authorization: Bearer <cap>` | Capability token (when required) |

## Contract Testing

Verify API compliance:

```bash
# Run contract verification against running service
curl -s http://localhost:3000/api/health | npx tsx scripts/verify-api-envelope.ts

# Or run full contract test suite
make verify:contracts
```

Contract tests validate:
- All responses match envelope schema
- Error responses never include stack traces
- Trace IDs are present and valid format
- Timestamps are ISO 8601
- Pagination follows schema when present
