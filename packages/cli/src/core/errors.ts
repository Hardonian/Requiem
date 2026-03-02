/**
 * Unified Error System
 *
 * One error system for CLI, Engine, and Web.
 * INVARIANT: All thrown errors MUST be AppError or wrapped into AppError at boundary.
 * INVARIANT: No raw Error throws in production code paths.
 */

// =============================================================================
// ERROR CODE TAXONOMY - Stable, typed, documented
// =============================================================================

export type ErrorCode =
  // Config errors (E_CFG_*)
  | 'E_CFG_INVALID'
  | 'E_CFG_MISSING'
  | 'E_CFG_DEPRECATED'
  | 'E_CFG_PARSE_FAILED'
  | 'E_CFG_VERSION_MISMATCH'

  // Database errors (E_DB_*)
  | 'E_DB_CONNECTION_FAILED'
  | 'E_DB_QUERY_FAILED'
  | 'E_DB_CONSTRAINT_VIOLATION'
  | 'E_DB_MIGRATION_FAILED'
  | 'E_DB_NOT_FOUND'

  // Artifact Store errors (E_CAS_*)
  | 'E_CAS_INTEGRITY_FAILED'
  | 'E_CAS_NOT_FOUND'
  | 'E_CAS_WRITE_FAILED'
  | 'E_CAS_READ_FAILED'
  | 'E_CAS_CORRUPTED'

  // Signing/Verification errors (E_SIG_*)
  | 'E_SIG_INVALID'
  | 'E_SIG_VERIFICATION_FAILED'
  | 'E_SIG_KEY_NOT_FOUND'
  | 'E_SIG_EXPIRED'
  | 'E_SIG_REVOKED'

  // Policy/Quota errors (E_POL_*)
  | 'E_POL_VIOLATION'
  | 'E_POL_QUOTA_EXCEEDED'
  | 'E_POL_RATE_LIMITED'
  | 'E_POL_UNAUTHORIZED'
  | 'E_POL_FORBIDDEN'

  // Provider/Arbitration errors (E_PROV_*)
  | 'E_PROV_UNAVAILABLE'
  | 'E_PROV_TIMEOUT'
  | 'E_PROV_INVALID_RESPONSE'
  | 'E_PROV_ARBITRATION_FAILED'
  | 'E_PROV_CIRCUIT_OPEN'

  // Network errors (E_NET_*)
  | 'E_NET_CONNECTION_FAILED'
  | 'E_NET_TIMEOUT'
  | 'E_NET_DNS_FAILED'
  | 'E_NET_TLS_FAILED'
  | 'E_NET_RETRY_EXHAUSTED'

  // Filesystem errors (E_IO_*)
  | 'E_IO_NOT_FOUND'
  | 'E_IO_PERMISSION_DENIED'
  | 'E_IO_READ_FAILED'
  | 'E_IO_WRITE_FAILED'
  | 'E_IO_LOCKED'

  // Invariant/Determinism/Replay errors (E_INT_*)
  | 'E_INT_DETERMINISM_VIOLATION'
  | 'E_INT_REPLAY_MISMATCH'
  | 'E_INT_HASH_MISMATCH'
  | 'E_INT_INVARIANT_VIOLATION'
  | 'E_INT_STATE_CORRUPTED'

  // Web/Route errors (E_WEB_*)
  | 'E_WEB_INVALID_REQUEST'
  | 'E_WEB_ROUTE_NOT_FOUND'
  | 'E_WEB_METHOD_NOT_ALLOWED'
  | 'E_WEB_PAYLOAD_TOO_LARGE'
  | 'E_WEB_VALIDATION_FAILED'

  // General errors
  | 'E_UNKNOWN'
  | 'E_NOT_IMPLEMENTED'
  | 'E_INTERNAL';

// Error code to category mapping for quick filtering
export const ERROR_CATEGORIES: Record<string, ErrorCode[]> = {
  config: ['E_CFG_INVALID', 'E_CFG_MISSING', 'E_CFG_DEPRECATED', 'E_CFG_PARSE_FAILED', 'E_CFG_VERSION_MISMATCH'],
  database: ['E_DB_CONNECTION_FAILED', 'E_DB_QUERY_FAILED', 'E_DB_CONSTRAINT_VIOLATION', 'E_DB_MIGRATION_FAILED', 'E_DB_NOT_FOUND'],
  cas: ['E_CAS_INTEGRITY_FAILED', 'E_CAS_NOT_FOUND', 'E_CAS_WRITE_FAILED', 'E_CAS_READ_FAILED', 'E_CAS_CORRUPTED'],
  signing: ['E_SIG_INVALID', 'E_SIG_VERIFICATION_FAILED', 'E_SIG_KEY_NOT_FOUND', 'E_SIG_EXPIRED', 'E_SIG_REVOKED'],
  policy: ['E_POL_VIOLATION', 'E_POL_QUOTA_EXCEEDED', 'E_POL_RATE_LIMITED', 'E_POL_UNAUTHORIZED', 'E_POL_FORBIDDEN'],
  provider: ['E_PROV_UNAVAILABLE', 'E_PROV_TIMEOUT', 'E_PROV_INVALID_RESPONSE', 'E_PROV_ARBITRATION_FAILED', 'E_PROV_CIRCUIT_OPEN'],
  network: ['E_NET_CONNECTION_FAILED', 'E_NET_TIMEOUT', 'E_NET_DNS_FAILED', 'E_NET_TLS_FAILED', 'E_NET_RETRY_EXHAUSTED'],
  io: ['E_IO_NOT_FOUND', 'E_IO_PERMISSION_DENIED', 'E_IO_READ_FAILED', 'E_IO_WRITE_FAILED', 'E_IO_LOCKED'],
  invariant: ['E_INT_DETERMINISM_VIOLATION', 'E_INT_REPLAY_MISMATCH', 'E_INT_HASH_MISMATCH', 'E_INT_INVARIANT_VIOLATION', 'E_INT_STATE_CORRUPTED'],
  web: ['E_WEB_INVALID_REQUEST', 'E_WEB_ROUTE_NOT_FOUND', 'E_WEB_METHOD_NOT_ALLOWED', 'E_WEB_PAYLOAD_TOO_LARGE', 'E_WEB_VALIDATION_FAILED'],
};

// =============================================================================
// SEVERITY LEVELS
// =============================================================================

export type ErrorSeverity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const SEVERITY_ORDER: Record<ErrorSeverity, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// =============================================================================
// APP ERROR TYPE
// =============================================================================

export interface AppErrorDetails {
  [key: string]: unknown;
}

export interface AppError {
  /** Stable error code */
  code: ErrorCode;
  /** Human-readable message (safe for display) */
  message: string;
  /** Structured details (safe after redaction) */
  details?: AppErrorDetails;
  /** Underlying cause */
  cause?: Error | AppError;
  /** Action steps for remediation */
  remediation?: string[];
  /** Severity level */
  severity: ErrorSeverity;
  /** Tags for categorization */
  tags?: string[];
  /** Whether retry may succeed */
  isRetryable: boolean;
  /** Whether this error is safe for external display */
  isRedactionSafe: boolean;
  /** ISO timestamp */
  timestamp: string;
  /** Trace ID for correlation */
  traceId?: string;
  /** Component that emitted the error */
  component?: string;
}

// =============================================================================
// REDACTION PIPELINE
// =============================================================================

const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'key', 'apikey', 'api_key',
  'auth', 'credential', 'privatekey', 'private_key', 'access_token',
  'refresh_token', 'id_token', 'bearer', 'authorization',
  'cookie', 'session', 'passwd', 'pwd', 'pass',
]);

const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api_?key/i,
  /private_?key/i,
  /credential/i,
  /authorization/i,
  /bearer/i,
  /session/i,
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lower)) return true;
  return SENSITIVE_PATTERNS.some(p => p.test(key));
}

export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[DEPTH_LIMITED]';

  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Mask potential secrets in strings
    if (value.length > 100 && (/^[A-Za-z0-9+/=]{100,}$/.test(value) || /^[a-f0-9]{64,}$/i.test(value))) {
      return `${value.substring(0, 8)}...[REDACTED:${value.length}chars]`;
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return String(value);

  if (Array.isArray(value)) {
    return value.map(v => sanitizeValue(v, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      const valStr = String(val);
      sanitized[key] = valStr.length > 10
        ? `[REDACTED:${valStr.substring(0, 4)}...]`
        : '[REDACTED]';
    } else {
      sanitized[key] = sanitizeValue(val, depth + 1);
    }
  }
  return sanitized;
}

export function sanitizeError(error: AppError): AppError {
  return {
    ...error,
    details: error.details ? sanitizeValue(error.details) as AppErrorDetails : undefined,
    cause: undefined, // Never expose cause chain externally
    isRedactionSafe: true,
  };
}

// =============================================================================
// ERROR FACTORY
// =============================================================================

export function err(
  code: ErrorCode,
  message: string,
  options: {
    details?: AppErrorDetails;
    cause?: Error | AppError;
    remediation?: string[];
    severity?: ErrorSeverity;
    tags?: string[];
    isRetryable?: boolean;
    traceId?: string;
    component?: string;
  } = {}
): AppError {
  return {
    code,
    message,
    details: options.details,
    cause: options.cause,
    remediation: options.remediation,
    severity: options.severity ?? 'error',
    tags: options.tags,
    isRetryable: options.isRetryable ?? false,
    isRedactionSafe: false,
    timestamp: new Date().toISOString(),
    traceId: options.traceId,
    component: options.component,
  };
}

export function wrap(error: unknown, context: string, component?: string): AppError {
  if (isAppError(error)) {
    return {
      ...error,
      message: `${context}: ${error.message}`,
      component: component ?? error.component,
    };
  }

  if (error instanceof Error) {
    return err('E_UNKNOWN', `${context}: ${error.message}`, {
      cause: error,
      severity: 'error',
      component,
    });
  }

  return err('E_UNKNOWN', `${context}: ${String(error)}`, {
    severity: 'error',
    component,
  });
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'severity' in error &&
    'isRetryable' in error &&
    typeof (error as AppError).code === 'string' &&
    (error as AppError).code.includes('_')
  );
}

// =============================================================================
// SERIALIZATION
// =============================================================================

export function toJSON(error: AppError, safe = true): string {
  const toSerialize = safe ? sanitizeError(error) : error;
  return JSON.stringify(toSerialize);
}

export function toJSONObject(error: AppError, safe = true): Record<string, unknown> {
  const e = safe ? sanitizeError(error) : error;
  return {
    code: e.code,
    message: e.message,
    severity: e.severity,
    isRetryable: e.isRetryable,
    timestamp: e.timestamp,
    ...(e.details && { details: e.details }),
    ...(e.remediation && { remediation: e.remediation }),
    ...(e.tags && { tags: e.tags }),
    ...(e.traceId && { traceId: e.traceId }),
    ...(e.component && { component: e.component }),
  };
}

export function formatHuman(error: AppError): string {
  const parts: string[] = [];
  parts.push(`[${error.code}] ${error.message}`);

  if (error.remediation && error.remediation.length > 0) {
    parts.push('');
    parts.push('Remediation:');
    for (const step of error.remediation) {
      parts.push(`  • ${step}`);
    }
  }

  if (error.traceId) {
    parts.push(`\nTrace ID: ${error.traceId}`);
  }

  return parts.join('\n');
}

// =============================================================================
// HTTP STATUS MAPPING
// =============================================================================

export function toHttpStatus(error: AppError): number {
  const statusMap: Record<string, number> = {
    E_CFG_INVALID: 400,
    E_CFG_MISSING: 400,
    E_CFG_PARSE_FAILED: 400,
    E_DB_NOT_FOUND: 404,
    E_CAS_NOT_FOUND: 404,
    E_IO_NOT_FOUND: 404,
    E_POL_UNAUTHORIZED: 401,
    E_POL_FORBIDDEN: 403,
    E_POL_QUOTA_EXCEEDED: 429,
    E_POL_RATE_LIMITED: 429,
    E_WEB_INVALID_REQUEST: 400,
    E_WEB_ROUTE_NOT_FOUND: 404,
    E_WEB_METHOD_NOT_ALLOWED: 405,
    E_WEB_PAYLOAD_TOO_LARGE: 413,
    E_WEB_VALIDATION_FAILED: 422,
    E_NET_TIMEOUT: 504,
    E_PROV_TIMEOUT: 504,
    E_PROV_UNAVAILABLE: 503,
  };

  return statusMap[error.code] ?? 500;
}

// =============================================================================
// PREDEFINED ERROR HELPERS
// =============================================================================

export const Errors = {
  notFound: (resource: string, id?: string, component?: string) =>
    err('E_IO_NOT_FOUND', `${resource}${id ? ` '${id}'` : ''} not found`, {
      severity: 'info',
      component,
      remediation: ['Verify the resource identifier is correct', 'Check if the resource was deleted'],
    }),

  invalidInput: (field: string, reason: string, component?: string) =>
    err('E_CFG_INVALID', `Invalid input for '${field}': ${reason}`, {
      severity: 'warn',
      component,
      remediation: ['Check the input format', 'Refer to the documentation for valid values'],
    }),

  dbConnection: (cause?: Error, component?: string) =>
    err('E_DB_CONNECTION_FAILED', 'Database connection failed', {
      cause,
      severity: 'fatal',
      isRetryable: true,
      component,
      remediation: [
        'Check database server is running',
        'Verify connection string in configuration',
        'Check network connectivity',
      ],
    }),

  determinism: (details: string, traceId?: string, component?: string) =>
    err('E_INT_DETERMINISM_VIOLATION', `Determinism violation: ${details}`, {
      severity: 'fatal',
      traceId,
      component,
      remediation: [
        'This is a critical system invariant failure',
        'Check for non-deterministic operations (timers, random, I/O ordering)',
        'Review recent changes to execution logic',
        'Contact system administrator immediately',
      ],
    }),

  casIntegrity: (digest: string, expected: string, component?: string) =>
    err('E_CAS_INTEGRITY_FAILED', `CAS integrity check failed for object`, {
      severity: 'fatal',
      component,
      details: { digest: digest.substring(0, 16), expected: expected.substring(0, 16) },
      remediation: [
        'Object may be corrupted or tampered with',
        'Restore from backup if available',
        'Check storage subsystem health',
      ],
    }),

  rateLimited: (retryAfterSeconds?: number, component?: string) =>
    err('E_POL_RATE_LIMITED', 'Rate limit exceeded', {
      severity: 'warn',
      isRetryable: true,
      component,
      details: retryAfterSeconds ? { retryAfter: retryAfterSeconds } : undefined,
      remediation: retryAfterSeconds
        ? [`Retry after ${retryAfterSeconds} seconds`]
        : ['Reduce request frequency', 'Contact support to increase quota'],
    }),

  internal: (message: string, cause?: Error, component?: string) =>
    err('E_INTERNAL', message, {
      cause,
      severity: 'error',
      component,
      isRetryable: true,
    }),

  engineUnavailable: (apiUrl: string, component?: string) =>
    err('E_PROV_UNAVAILABLE', `Native engine node at ${apiUrl} is unreachable`, {
      severity: 'error',
      isRetryable: true,
      component,
      remediation: [
        'Check if the native engine is running',
        'Verify REQUIEM_API_URL is correct',
        'Check network connectivity and firewall rules',
        'Run "reach doctor" to validate environment',
      ],
    }),
};

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

export function assertInvariant(
  condition: boolean,
  message: string,
  component?: string
): asserts condition {
  if (!condition) {
    throw err('E_INT_INVARIANT_VIOLATION', message, {
      severity: 'fatal',
      component,
      remediation: ['This is a bug - report it with full context'],
    });
  }
}

export function assertDefined<T>(
  value: T | undefined | null,
  name: string,
  component?: string
): T {
  if (value === undefined || value === null) {
    throw err('E_INT_INVARIANT_VIOLATION', `Expected ${name} to be defined`, {
      severity: 'fatal',
      component,
    });
  }
  return value;
}
