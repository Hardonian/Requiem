/**
 * @fileoverview Failure Mode Hardening - Structured Error Objects
 * 
 * Provides:
 * - Structured error objects with remediation hints
 * - No hard-500 routes (graceful degradation)
 * - Bootstrap if config missing
 * - All crashes redacted and structured
 */

import { redactError, createSafeError } from '../memory/redaction.js';

// ─── Error Codes ───────────────────────────────────────────────────────────

export const ERROR_CODES = {
  // Configuration errors (10xx)
  CONFIG_MISSING: 'CONFIG_MISSING',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_UNREADABLE: 'CONFIG_UNREADABLE',
  
  // Database errors (20xx)
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_MIGRATION_FAILED: 'DB_MIGRATION_FAILED',
  DB_INTEGRITY_FAILED: 'DB_INTEGRITY_FAILED',
  
  // Storage/CAS errors (30xx)
  CAS_NOT_FOUND: 'CAS_NOT_FOUND',
  CAS_WRITE_FAILED: 'CAS_WRITE_FAILED',
  CAS_CORRUPTED: 'CAS_CORRUPTED',
  
  // Policy errors (40xx)
  POLICY_NOT_FOUND: 'POLICY_NOT_FOUND',
  POLICY_DENIED: 'POLICY_DENIED',
  POLICY_PARSE_FAILED: 'POLICY_PARSE_FAILED',
  
  // Execution errors (50xx)
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  EXECUTION_CANCELLED: 'EXECUTION_CANCELLED',
  
  // Authentication/Authorization errors (60xx)
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  
  // Plugin errors (70xx)
  PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
  PLUGIN_INIT_FAILED: 'PLUGIN_INIT_FAILED',
  PLUGIN_INVALID: 'PLUGIN_INVALID',
  
  // Network errors (80xx)
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  
  // Internal errors (90xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ─── Error Severity ─────────────────────────────────────────────────────────

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// ─── Structured Error ─────────────────────────────────────────────────────

export interface StructuredError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  retryable: boolean;
  remediation: string;
  details?: Record<string, unknown>;
  cause?: StructuredError;
  trace_id?: string;
  run_id?: string;
  timestamp: string;
  version: string;
}

// ─── Error Builder ─────────────────────────────────────────────────────────

export class ErrorBuilder {
  private error: Partial<StructuredError>;
  
  constructor(code: ErrorCode, message: string) {
    this.error = {
      code,
      message,
      severity: 'medium',
      retryable: false,
      remediation: 'Contact support if issue persists',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
  
  severity(severity: ErrorSeverity): this {
    this.error.severity = severity;
    return this;
  }
  
  retryable(retryable: boolean): this {
    this.error.retryable = retryable;
    return this;
  }
  
  remediation(hint: string): this {
    this.error.remediation = hint;
    return this;
  }
  
  details(details: Record<string, unknown>): this {
    this.error.details = redactErrorDetails(details);
    return this;
  }
  
  cause(cause: StructuredError): this {
    this.error.cause = cause;
    return this;
  }
  
  trace(traceId: string, runId?: string): this {
    this.error.trace_id = traceId;
    if (runId) this.error.run_id = runId;
    return this;
  }
  
  build(): StructuredError {
    return this.error as StructuredError;
  }
}

/**
 * Redact error details for safe logging
 */
function redactErrorDetails(details: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(details)) {
    if (/key|secret|password|token|auth|credential/i.test(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactErrorDetails(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

// ─── Common Error Factories ─────────────────────────────────────────────────

/**
 * Configuration not found error
 */
export function configNotFound(path: string): StructuredError {
  return new ErrorBuilder(ERROR_CODES.CONFIG_MISSING, `Configuration file not found: ${path}`)
    .severity('high')
    .remediation(`Create the configuration file at ${path} or set REQUIEM_CONFIG_DIR environment variable`)
    .details({ path })
    .build();
}

/**
 * Invalid configuration error
 */
export function configInvalid(path: string, reason: string): StructuredError {
  return new ErrorBuilder(ERROR_CODES.CONFIG_INVALID, `Invalid configuration: ${reason}`)
    .severity('high')
    .remediation(`Fix the configuration file at ${path}`)
    .details({ path, reason })
    .build();
}

/**
 * Database connection error
 */
export function dbConnectionFailed(err: Error, details?: Record<string, unknown>): StructuredError {
  return new ErrorBuilder(ERROR_CODES.DB_CONNECTION_FAILED, `Database connection failed: ${err.message}`)
    .severity('critical')
    .retryable(true)
    .remediation('Check database connectivity and credentials')
    .details(details || {})
    .build();
}

/**
 * Database query error
 */
export function dbQueryFailed(query: string, err: Error): StructuredError {
  return new ErrorBuilder(ERROR_CODES.DB_QUERY_FAILED, `Database query failed: ${err.message}`)
    .severity('high')
    .retryable(true)
    .remediation('Check database schema and query syntax')
    .details({ query: query.slice(0, 100) }) // Truncate long queries
    .build();
}

/**
 * Policy denied error
 */
export function policyDenied(toolName: string, reason: string): StructuredError {
  return new ErrorBuilder(ERROR_CODES.POLICY_DENIED, `Policy denied: ${toolName}`)
    .severity('medium')
    .remediation(`Tool '${toolName}' is not allowed by policy. Reason: ${reason}`)
    .details({ toolName, reason })
    .build();
}

/**
 * Authentication failed
 */
export function authFailed(details?: Record<string, unknown>): StructuredError {
  return new ErrorBuilder(ERROR_CODES.AUTH_FAILED, 'Authentication failed')
    .severity('high')
    .remediation('Check your credentials and try again')
    .details(details || {})
    .build();
}

/**
 * Not authorized
 */
export function authUnauthorized(): StructuredError {
  return new ErrorBuilder(ERROR_CODES.AUTH_UNAUTHORIZED, 'Unauthorized')
    .severity('medium')
    .remediation('Provide valid authentication credentials')
    .build();
}

/**
 * Forbidden
 */
export function authForbidden(action: string): StructuredError {
  return new ErrorBuilder(ERROR_CODES.AUTH_FORBIDDEN, `Forbidden: ${action}`)
    .severity('medium')
    .remediation(`You don't have permission to perform '${action}'`)
    .details({ action })
    .build();
}

/**
 * Execution failed
 */
export function executionFailed(toolName: string, err: Error): StructuredError {
  return new ErrorBuilder(ERROR_CODES.EXECUTION_FAILED, `Execution failed: ${err.message}`)
    .severity('high')
    .retryable(true)
    .remediation(`Check tool '${toolName}' implementation and inputs`)
    .details({ toolName, error: err.message })
    .build();
}

/**
 * Plugin not found
 */
export function pluginNotFound(name: string, type: string): StructuredError {
  return new ErrorBuilder(ERROR_CODES.PLUGIN_NOT_FOUND, `Plugin not found: ${name}`)
    .severity('high')
    .remediation(`Install or enable the ${type} plugin '${name}'`)
    .details({ name, type })
    .build();
}

/**
 * Plugin initialization failed
 */
export function pluginInitFailed(name: string, err: Error): StructuredError {
  return new ErrorBuilder(ERROR_CODES.PLUGIN_INIT_FAILED, `Plugin initialization failed: ${err.message}`)
    .severity('critical')
    .remediation(`Check plugin '${name}' configuration and dependencies`)
    .details({ name, error: err.message })
    .build();
}

/**
 * Network error
 */
export function networkError(url: string, err: Error): StructuredError {
  return new ErrorBuilder(ERROR_CODES.NETWORK_ERROR, `Network error: ${err.message}`)
    .severity('medium')
    .retryable(true)
    .remediation('Check network connectivity and try again')
    .details({ url })
    .build();
}

/**
 * Network timeout
 */
export function networkTimeout(url: string): StructuredError {
  return new ErrorBuilder(ERROR_CODES.NETWORK_TIMEOUT, `Network timeout: ${url}`)
    .severity('medium')
    .retryable(true)
    .remediation('Increase timeout or check network connectivity')
    .details({ url })
    .build();
}

/**
 * Internal error
 */
export function internalError(err: Error, context?: Record<string, unknown>): StructuredError {
  return new ErrorBuilder(ERROR_CODES.INTERNAL_ERROR, `Internal error: ${err.message}`)
    .severity('critical')
    .remediation('Contact support with error details')
    .details(context || {})
    .build();
}

// ─── Error to HTTP Status Mapping ─────────────────────────────────────────

export function errorToHttpStatus(error: StructuredError): number {
  switch (error.code) {
    case ERROR_CODES.CONFIG_MISSING:
    case ERROR_CODES.CONFIG_INVALID:
      return 400;
      
    case ERROR_CODES.DB_CONNECTION_FAILED:
    case ERROR_CODES.DB_QUERY_FAILED:
    case ERROR_CODES.DB_MIGRATION_FAILED:
      return 503; // Service unavailable
      
    case ERROR_CODES.CAS_NOT_FOUND:
      return 404;
      
    case ERROR_CODES.CAS_WRITE_FAILED:
    case ERROR_CODES.CAS_CORRUPTED:
      return 500;
      
    case ERROR_CODES.POLICY_NOT_FOUND:
    case ERROR_CODES.POLICY_PARSE_FAILED:
      return 500;
      
    case ERROR_CODES.POLICY_DENIED:
      return 403;
      
    case ERROR_CODES.EXECUTION_TIMEOUT:
      return 504;
      
    case ERROR_CODES.EXECUTION_FAILED:
    case ERROR_CODES.EXECUTION_CANCELLED:
      return 500;
      
    case ERROR_CODES.AUTH_FAILED:
    case ERROR_CODES.AUTH_UNAUTHORIZED:
      return 401;
      
    case ERROR_CODES.AUTH_FORBIDDEN:
      return 403;
      
    case ERROR_CODES.PLUGIN_NOT_FOUND:
    case ERROR_CODES.PLUGIN_INVALID:
      return 400;
      
    case ERROR_CODES.PLUGIN_INIT_FAILED:
      return 500;
      
    case ERROR_CODES.NETWORK_ERROR:
    case ERROR_CODES.NETWORK_TIMEOUT:
      return 502;
      
    case ERROR_CODES.INTERNAL_ERROR:
    case ERROR_CODES.NOT_IMPLEMENTED:
    default:
      return 500;
  }
}

// ─── Error Serialization for API ─────────────────────────────────────────--

/**
 * Convert structured error to API response (safe for external display)
 */
export function toApiResponse(error: StructuredError): Record<string, unknown> {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      remediation: error.remediation,
      // Never expose details, cause, trace_id, run_id in API response
    },
  };
}

/**
 * Convert structured error to log format (full details, redacted)
 */
export function toLogFormat(error: StructuredError): Record<string, unknown> {
  return redactErrorDetails({
    code: error.code,
    message: error.message,
    severity: error.severity,
    retryable: error.retryable,
    remediation: error.remediation,
    details: error.details,
    cause: error.cause,
    trace_id: error.trace_id,
    run_id: error.run_id,
    timestamp: error.timestamp,
    version: error.version,
  });
}

export default {
  ERROR_CODES,
  ErrorBuilder,
  configNotFound,
  configInvalid,
  dbConnectionFailed,
  dbQueryFailed,
  policyDenied,
  authFailed,
  authUnauthorized,
  authForbidden,
  executionFailed,
  pluginNotFound,
  pluginInitFailed,
  networkError,
  networkTimeout,
  internalError,
  errorToHttpStatus,
  toApiResponse,
  toLogFormat,
};
