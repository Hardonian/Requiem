# Error System

Unified error system for CLI, Engine, and Web.

## Error Codes

Errors use stable, typed codes following the pattern `E_CATEGORY_DETAIL`.

### Config Errors (E_CFG_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_CFG_INVALID` | Invalid configuration value | Check config file syntax |
| `E_CFG_MISSING` | Required config missing | Set the required environment variable or config key |
| `E_CFG_DEPRECATED` | Using deprecated config | Update to the new config format |
| `E_CFG_PARSE_FAILED` | Config file parse error | Fix JSON/TOML/YAML syntax |
| `E_CFG_VERSION_MISMATCH` | Config version incompatible | Migrate config to current version |

### Database Errors (E_DB_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_DB_CONNECTION_FAILED` | Cannot connect to SQLite | Check file permissions, disk space |
| `E_DB_QUERY_FAILED` | SQL query failed | Check query syntax, schema version |
| `E_DB_CONSTRAINT_VIOLATION` | Constraint violation | Check for duplicates, foreign keys |
| `E_DB_MIGRATION_FAILED` | Migration failed | Check migration logs, backup and retry |
| `E_DB_NOT_FOUND` | Record not found | Verify the ID exists |

### CAS Errors (E_CAS_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_CAS_INTEGRITY_FAILED` | Hash mismatch | Object may be corrupted; restore from backup |
| `E_CAS_NOT_FOUND` | Object not in store | Check the hash, verify storage path |
| `E_CAS_WRITE_FAILED` | Write to store failed | Check disk space, permissions |
| `E_CAS_READ_FAILED` | Read from store failed | Check file permissions |
| `E_CAS_CORRUPTED` | Store structure corrupted | Rebuild from backup |

### Signing/Verification (E_SIG_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_SIG_INVALID` | Signature format invalid | Check signature encoding |
| `E_SIG_VERIFICATION_FAILED` | Signature doesn't verify | Check public key, data integrity |
| `E_SIG_KEY_NOT_FOUND` | Signing key missing | Generate or import the key |
| `E_SIG_EXPIRED` | Signature expired | Re-sign with current key |
| `E_SIG_REVOKED` | Key has been revoked | Use a different key |

### Policy/Quota (E_POL_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_POL_VIOLATION` | Policy rule violated | Review policy, adjust request |
| `E_POL_QUOTA_EXCEEDED` | Quota limit reached | Wait for reset or request increase |
| `E_POL_RATE_LIMITED` | Rate limit hit | Reduce request frequency |
| `E_POL_UNAUTHORIZED` | Not authenticated | Provide valid credentials |
| `E_POL_FORBIDDEN` | Not authorized for action | Check permissions |

### Provider/Arbitration (E_PROV_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_PROV_UNAVAILABLE` | Provider not responding | Check provider status, network |
| `E_PROV_TIMEOUT` | Provider request timed out | Retry with longer timeout |
| `E_PROV_INVALID_RESPONSE` | Provider returned invalid data | Check provider docs, report bug |
| `E_PROV_ARBITRATION_FAILED` | Could not select provider | Check provider list, weights |
| `E_PROV_CIRCUIT_OPEN` | Circuit breaker is open | Wait for cooldown, check health |

### Network (E_NET_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_NET_CONNECTION_FAILED` | Cannot establish connection | Check network, firewall |
| `E_NET_TIMEOUT` | Network timeout | Check latency, retry |
| `E_NET_DNS_FAILED` | DNS resolution failed | Check DNS settings, hostname |
| `E_NET_TLS_FAILED` | TLS handshake failed | Check certificates, clock |
| `E_NET_RETRY_EXHAUSTED` | All retries failed | Check service health |

### Filesystem (E_IO_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_IO_NOT_FOUND` | File/directory not found | Check path, create if needed |
| `E_IO_PERMISSION_DENIED` | Access denied | Check permissions, ownership |
| `E_IO_READ_FAILED` | Read operation failed | Check file exists, permissions |
| `E_IO_WRITE_FAILED` | Write operation failed | Check disk space, permissions |
| `E_IO_LOCKED` | Resource locked | Wait for other process |

### Invariant/Determinism (E_INT_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_INT_DETERMINISM_VIOLATION` | Non-deterministic execution | **CRITICAL** - Check for timers, random, I/O ordering |
| `E_INT_REPLAY_MISMATCH` | Replay produced different result | **CRITICAL** - Check for non-determinism |
| `E_INT_HASH_MISMATCH` | Content hash mismatch | **CRITICAL** - Data may be corrupted |
| `E_INT_INVARIANT_VIOLATION` | Code invariant broken | **BUG** - Report with full context |
| `E_INT_STATE_CORRUPTED` | Internal state corrupted | **CRITICAL** - Restart, check storage |

### Web/Routes (E_WEB_*)

| Code | Meaning | Remediation |
|------|---------|-------------|
| `E_WEB_INVALID_REQUEST` | Malformed request | Check request format |
| `E_WEB_ROUTE_NOT_FOUND` | Endpoint doesn't exist | Check URL, API version |
| `E_WEB_METHOD_NOT_ALLOWED` | HTTP method not allowed | Use correct verb |
| `E_WEB_PAYLOAD_TOO_LARGE` | Request body too big | Reduce payload size |
| `E_WEB_VALIDATION_FAILED` | Request validation failed | Check schema, required fields |

## Using the Error System

```typescript
import { err, wrap, Errors, isAppError } from '../core/errors.js';

// Create a structured error
throw err('E_CFG_INVALID', 'Invalid timeout value', {
  severity: 'warn',
  details: { field: 'timeout', value: -1 },
  remediation: ['Set timeout to a positive number', 'Or use 0 to disable'],
});

// Wrap an unknown error
try {
  await riskyOperation();
} catch (e) {
  throw wrap(e, 'Database query failed', 'DecisionRepository');
}

// Use predefined helpers
throw Errors.notFound('Decision', 'dec-123');
throw Errors.rateLimited(60); // retry after 60s

// Check if error is AppError
if (isAppError(error)) {
  console.log(error.code); // E_CFG_INVALID
}
```

## Redaction

Errors are automatically redacted when serialized for external display:

```typescript
import { sanitizeError, toJSON } from '../core/errors.js';

const safe = sanitizeError(error);
// Sensitive fields (password, token, secret) are replaced with [REDACTED]

const json = toJSON(error, true); // safe = true
```

## Severity Levels

- `debug` - Diagnostics only
- `info` - Expected conditions (e.g., not found)
- `warn` - Degraded but functional
- `error` - Operation failed, user action may help
- `fatal` - System issue, requires operator intervention

## HTTP Status Mapping

```typescript
import { toHttpStatus } from '../core/errors.js';

const status = toHttpStatus(error); // 400, 404, 500, etc.
```
