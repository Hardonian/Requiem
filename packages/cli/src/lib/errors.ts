/**
 * Structured Error Envelope
 * 
 * Unified error model with stable identifiers, severity levels,
 * and safe serialization for UI/CLI consumption.
 * 
 * INVARIANT: All errors thrown across the codebase MUST use
 * RequiemError or its subclasses for consistent handling.
 */

/**
 * Error codes are stable identifiers that survive refactoring.
 * Used for programmatic error handling and internationalization.
 */
export enum ErrorCode {
  // System/IO errors (1000-1099)
  FILE_NOT_FOUND = 'REQ_FILE_NOT_FOUND',
  PERMISSION_DENIED = 'REQ_PERMISSION_DENIED',
  IO_ERROR = 'REQ_IO_ERROR',
  NETWORK_ERROR = 'REQ_NETWORK_ERROR',
  TIMEOUT = 'REQ_TIMEOUT',

  // Validation errors (1100-1199)
  INVALID_INPUT = 'REQ_INVALID_INPUT',
  VALIDATION_FAILED = 'REQ_VALIDATION_FAILED',
  SCHEMA_MISMATCH = 'REQ_SCHEMA_MISMATCH',
  MISSING_REQUIRED = 'REQ_MISSING_REQUIRED',

  // Engine errors (1200-1299)
  ENGINE_UNAVAILABLE = 'REQ_ENGINE_UNAVAILABLE',
  ENGINE_EXECUTION_FAILED = 'REQ_ENGINE_EXECUTION_FAILED',
  ENGINE_TIMEOUT = 'REQ_ENGINE_TIMEOUT',
  ENGINE_SANDBOX_VIOLATION = 'REQ_ENGINE_SANDBOX_VIOLATION',

  // CAS/Storage errors (1300-1399)
  CAS_INTEGRITY_FAILED = 'REQ_CAS_INTEGRITY_FAILED',
  CAS_NOT_FOUND = 'REQ_CAS_NOT_FOUND',
  CAS_WRITE_FAILED = 'REQ_CAS_WRITE_FAILED',

  // Tenant/Auth errors (1400-1499)
  TENANT_NOT_FOUND = 'REQ_TENANT_NOT_FOUND',
  TENANT_ACCESS_DENIED = 'REQ_TENANT_ACCESS_DENIED',
  UNAUTHORIZED = 'REQ_UNAUTHORIZED',
  FORBIDDEN = 'REQ_FORBIDDEN',
  MEMBERSHIP_REQUIRED = 'REQ_MEMBERSHIP_REQUIRED',

  // Determinism/Replay errors (1500-1599)
  REPLAY_MISMATCH = 'REQ_REPLAY_MISMATCH',
  DETERMINISM_VIOLATION = 'REQ_DETERMINISM_VIOLATION',
  HASH_MISMATCH = 'REQ_HASH_MISMATCH',

  // Decision/Junction errors (1600-1699)
  DECISION_FAILED = 'REQ_DECISION_FAILED',
  JUNCTION_CONFLICT = 'REQ_JUNCTION_CONFLICT',
  ORCHESTRATION_FAILED = 'REQ_ORCHESTRATION_FAILED',

  // Database errors (1700-1799)
  DB_CONNECTION_FAILED = 'REQ_DB_CONNECTION_FAILED',
  DB_CONSTRAINT_VIOLATION = 'REQ_DB_CONSTRAINT_VIOLATION',
  DB_TRANSACTION_FAILED = 'REQ_DB_TRANSACTION_FAILED',

  // Unknown (catch-all)
  UNKNOWN = 'REQ_UNKNOWN_ERROR',
  INTERNAL_ERROR = 'REQ_INTERNAL_ERROR',
}

/**
 * Severity levels for operational response.
 */
export enum ErrorSeverity {
  DEBUG = 'debug',       // Detailed diagnostics, not user-facing
  INFO = 'info',         // Expected conditions (e.g., not found)
  WARNING = 'warning',   // Degraded but functional
  ERROR = 'error',       // Operation failed, user action may help
  CRITICAL = 'critical', // System issue, requires operator intervention
}

/**
 * Standard error metadata for correlation and debugging.
 */
export interface ErrorMeta {
  /** Request/trace ID for log correlation */
  traceId?: string;
  /** Component emitting the error */
  component?: string;
  /** Operation phase where error occurred */
  phase?: string;
  /** Tenant context (if applicable) */
  tenantId?: string;
  /** User ID (if authenticated) */
  userId?: string;
  /** Run/execution ID (if applicable) */
  runId?: string;
  /** Additional structured context */
  context?: Record<string, unknown>;
}

/**
 * Structured error envelope.
 * 
 * INVARIANT: Never include secrets, tokens, or raw SQL in any field.
 * INVARIANT: message is safe for UI display (no internal details).
 * INVARIANT: cause chain is preserved for debugging.
 */
export interface ErrorEnvelope {
  /** Stable error identifier */
  code: ErrorCode;
  /** Human-readable message (safe for UI) */
  message: string;
  /** Severity level */
  severity: ErrorSeverity;
  /** Whether retry may succeed */
  retryable: boolean;
  /** Operation phase for debugging */
  phase?: string;
  /** Underlying cause (chain preserved) */
  cause?: ErrorEnvelope;
  /** Safe metadata (no secrets) */
  meta?: ErrorMeta;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Configuration for creating errors.
 */
export interface RequiemErrorOptions {
  code: ErrorCode;
  message: string;
  severity?: ErrorSeverity;
  retryable?: boolean;
  phase?: string;
  cause?: Error | RequiemError | ErrorEnvelope;
  meta?: ErrorMeta;
}

/**
 * Base error class for all Requiem errors.
 * 
 * Usage:
 *   throw new RequiemError({
 *     code: ErrorCode.ENGINE_UNAVAILABLE,
 *     message: 'Engine binary not found at expected path',
 *     severity: ErrorSeverity.ERROR,
 *     retryable: false,
 *   });
 */
export class RequiemError extends Error {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly phase?: string;
  readonly meta?: ErrorMeta;
  readonly cause?: Error;
  readonly timestamp: string;

  constructor(options: RequiemErrorOptions) {
    super(options.message);
    this.name = 'RequiemError';
    this.code = options.code;
    this.severity = options.severity ?? ErrorSeverity.ERROR;
    this.retryable = options.retryable ?? false;
    this.phase = options.phase;
    this.meta = options.meta;
    this.cause = options.cause instanceof Error ? options.cause : undefined;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RequiemError);
    }
  }

  /**
   * Convert to serializable envelope.
   * Safe for JSON.stringify and network transmission.
   */
  toEnvelope(): ErrorEnvelope {
    const envelope: ErrorEnvelope = {
      code: this.code,
      message: this.message,
      severity: this.severity,
      retryable: this.retryable,
      phase: this.phase,
      timestamp: this.timestamp,
    };

    if (this.meta) {
      envelope.meta = this.sanitizeMeta(this.meta);
    }

    if (this.cause) {
      envelope.cause = this.cause instanceof RequiemError
        ? this.cause.toEnvelope()
        : {
            code: ErrorCode.UNKNOWN,
            message: this.cause.message,
            severity: ErrorSeverity.DEBUG,
            retryable: false,
            timestamp: this.timestamp,
          };
    }

    return envelope;
  }

  /**
   * Sanitize metadata to ensure no secrets leak.
   */
  private sanitizeMeta(meta: ErrorMeta): ErrorMeta {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
    const sanitized: ErrorMeta = { ...meta };
    
    if (meta.context) {
      sanitized.context = Object.entries(meta.context).reduce((acc, [k, v]) => {
        const isSensitive = sensitiveKeys.some(sk => k.toLowerCase().includes(sk));
        acc[k] = isSensitive ? '[REDACTED]' : v;
        return acc;
      }, {} as Record<string, unknown>);
    }

    return sanitized;
  }

  /**
   * Serialize to JSON string.
   */
  toJSON(): string {
    return JSON.stringify(this.toEnvelope());
  }

  /**
   * Create from an unknown error (normalization).
   */
  static fromUnknown(error: unknown, fallbackMessage = 'An unexpected error occurred'): RequiemError {
    if (error instanceof RequiemError) {
      return error;
    }

    if (error instanceof Error) {
      return new RequiemError({
        code: ErrorCode.UNKNOWN,
        message: error.message || fallbackMessage,
        severity: ErrorSeverity.ERROR,
        retryable: false,
        cause: error,
      });
    }

    return new RequiemError({
      code: ErrorCode.UNKNOWN,
      message: typeof error === 'string' ? error : fallbackMessage,
      severity: ErrorSeverity.ERROR,
      retryable: false,
    });
  }
}

/**
 * Convenience factory functions for common error types.
 */
export const Errors = {
  validation: (message: string, meta?: ErrorMeta) => new RequiemError({
    code: ErrorCode.VALIDATION_FAILED,
    message,
    severity: ErrorSeverity.WARNING,
    retryable: false,
    meta,
  }),

  notFound: (resource: string, id: string, meta?: ErrorMeta) => new RequiemError({
    code: ErrorCode.FILE_NOT_FOUND,
    message: `${resource} not found: ${id}`,
    severity: ErrorSeverity.INFO,
    retryable: false,
    meta,
  }),

  tenantAccessDenied: (tenantId: string, userId?: string) => new RequiemError({
    code: ErrorCode.TENANT_ACCESS_DENIED,
    message: 'Access denied to requested tenant',
    severity: ErrorSeverity.WARNING,
    retryable: false,
    meta: { tenantId, userId },
  }),

  engineUnavailable: (details?: string) => new RequiemError({
    code: ErrorCode.ENGINE_UNAVAILABLE,
    message: `Engine unavailable${details ? `: ${details}` : ''}`,
    severity: ErrorSeverity.CRITICAL,
    retryable: true,
  }),

  determinismViolation: (details: string, meta?: ErrorMeta) => new RequiemError({
    code: ErrorCode.DETERMINISM_VIOLATION,
    message: `Determinism invariant violated: ${details}`,
    severity: ErrorSeverity.CRITICAL,
    retryable: false,
    phase: 'determinism_check',
    meta,
  }),

  casIntegrity: (digest: string, expected: string) => new RequiemError({
    code: ErrorCode.CAS_INTEGRITY_FAILED,
    message: `CAS integrity check failed for object ${digest.substring(0, 16)}...`,
    severity: ErrorSeverity.CRITICAL,
    retryable: false,
    meta: { context: { digest: digest.substring(0, 32), expectedHash: expected.substring(0, 32) } },
  }),

  internal: (_message: string, cause?: Error) => new RequiemError({
    code: ErrorCode.INTERNAL_ERROR,
    message: _message || 'An internal error occurred',
    severity: ErrorSeverity.ERROR,
    retryable: true,
    cause,
  }),
};

/**
 * HTTP status code mapping for error codes.
 * Used by server layer to return appropriate status codes.
 */
export function errorToHttpStatus(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.FILE_NOT_FOUND:
    case ErrorCode.CAS_NOT_FOUND:
    case ErrorCode.TENANT_NOT_FOUND:
      return 404;
    case ErrorCode.PERMISSION_DENIED:
    case ErrorCode.TENANT_ACCESS_DENIED:
    case ErrorCode.FORBIDDEN:
    case ErrorCode.MEMBERSHIP_REQUIRED:
      return 403;
    case ErrorCode.UNAUTHORIZED:
      return 401;
    case ErrorCode.VALIDATION_FAILED:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.SCHEMA_MISMATCH:
    case ErrorCode.MISSING_REQUIRED:
      return 400;
    case ErrorCode.TIMEOUT:
    case ErrorCode.ENGINE_TIMEOUT:
      return 504;
    case ErrorCode.RATE_LIMITED:
      return 429;
    case ErrorCode.DB_CONSTRAINT_VIOLATION:
      return 409;
    default:
      return 500;
  }
}

// Extended error codes for internal use
export const ErrorCodeExtended = {
  ...ErrorCode,
  RATE_LIMITED: 'REQ_RATE_LIMITED' as const,
};
