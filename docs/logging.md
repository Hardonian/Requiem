# Structured Logging

No `console.*` in production code. Use the structured logger instead.

## Quick Start

```typescript
import { logger } from '../core/logging.js';

// Simple log
logger.info('user.login', 'User logged in successfully');

// With fields
logger.info('decision.made', 'Decision recorded', {
  decisionId: 'dec-123',
  durationMs: 150,
});

// Error level
logger.error('db.query_failed', 'Database query failed', {
  query: 'SELECT...',
  error: err.message,
});
```

## Log Levels

| Level | Use For |
|-------|---------|
| `debug` | Detailed diagnostics, development only |
| `info` | Normal operations, state changes |
| `warn` | Degraded conditions, recoverable issues |
| `error` | Failures, action required |
| `fatal` | System unusable, operator intervention |

## Event Naming

Use `category.action` format:

- `user.login` - User authentication
- `decision.created` - Decision recorded
- `db.query_failed` - Database error
- `cas.object_stored` - Storage operation

## Field Guidelines

**DO:**
- Use camelCase for field names
- Include durationMs for operations
- Include IDs for correlation
- Use structured objects, not strings

**DON'T:**
- Log passwords, tokens, secrets
- Log large objects (>1KB)
- Use dynamic field names
- Include PII without redaction

```typescript
// Good
logger.info('file.read', 'File read', {
  path: '/data/file.txt',
  sizeBytes: 1024,
  durationMs: 5,
});

// Bad - secrets, unstructured
logger.info('file.read', 'Read /data/file.txt with token abc123secret');
```

## Logger Instance

For components with persistent context:

```typescript
import { Logger } from '../core/logging.js';

const log = new Logger({}, { component: 'DecisionEngine', tenantId });

// All logs include component and tenantId
log.info('decision.made', '...'); // { component: 'DecisionEngine', tenantId, ... }

// Child logger with more context
const childLog = log.withContext({ runId: 'run-456' });
```

## Configuration

```typescript
import { configureLogger, sinks } from '../core/logging.js';

// JSON to stderr (default)
configureLogger({ level: 'info' });

// Pretty for development
configureLogger({ 
  level: 'debug', 
  pretty: true,
  sinks: [sinks.console({ pretty: true })],
});

// Multiple sinks
configureLogger({
  sinks: [
    sinks.console({ minLevel: 'info' }),
    sinks.file('/var/log/requiem.log'),
  ],
});
```

## Development Mode

```typescript
import { enablePrettyLogs } from '../core/logging.js';

// In dev, call this early to get colored output
enablePrettyLogs('debug');
```

## Testing

```typescript
import { captureLogs } from '../core/logging.js';

const { result, logs } = captureLogs(() => {
  return myFunction();
});

// logs is LogEntry[]
expect(logs).toHaveLength(1);
expect(logs[0].event).toBe('decision.made');
```

## Log Format

JSON output (production):

```json
{
  "timestamp": "2026-03-01T19:18:00.000Z",
  "level": "info",
  "event": "decision.made",
  "message": "Decision recorded",
  "fields": {
    "decisionId": "dec-123",
    "durationMs": 150
  }
}
```

Pretty output (development):

```
[INFO ] 19:18:00 decision.made: Decision recorded {decisionId="dec-123" durationMs=150}
```

## Redaction

Sensitive fields are automatically redacted:

```typescript
logger.info('api.request', 'Request made', {
  apiKey: 'secret123',      // → [REDACTED:secr...]
  password: 'hunter2',      // → [REDACTED]
  userId: 'user-123',       // ← kept
});
```

Patterns that trigger redaction:
- `password`, `token`, `secret`, `key`
- `apikey`, `api_key`, `private_key`
- `authorization`, `bearer`
- `credential`, `session`

## Migration from console.*

```typescript
// Before
console.log('Processing decision', decisionId);
console.error('Failed:', err.message);

// After
logger.info('decision.processing', 'Processing decision', { decisionId });
logger.error('decision.failed', 'Decision processing failed', { 
  error: err.message,
  decisionId,
});
```
