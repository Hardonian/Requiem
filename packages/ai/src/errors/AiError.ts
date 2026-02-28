/**
 * @fileoverview AiError — structured error class for the AI control-plane.
 *
 * INVARIANT: All thrown errors from this package MUST be AiError instances.
 * INVARIANT: Stack traces MUST NOT appear in HTTP responses.
 * INVARIANT: Error codes are stable across releases.
 */

import { AiErrorCode, AiErrorSeverity, aiErrorToHttpStatus } from './codes';
import type { SerializedAiError } from '../types/index';

export interface AiErrorOptions {
  code: AiErrorCode;
  message: string;
  severity?: AiErrorSeverity;
  retryable?: boolean;
  /** Which phase produced the error (policy, tool, skill, model, memory, etc.) */
  phase?: string;
  /** Original error that caused this (not sent to client) */
  cause?: unknown;
  /** Extra metadata (redacted before sending to client) */
  meta?: Record<string, unknown>;
}

/**
 * Structured AI error with stable code, severity, and safe serialization.
 */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly severity: AiErrorSeverity;
  readonly retryable: boolean;
  readonly phase: string | undefined;
  readonly cause: unknown;
  readonly meta: Record<string, unknown> | undefined;

  constructor(opts: AiErrorOptions) {
    super(opts.message);
    this.name = 'AiError';
    this.code = opts.code;
    this.severity = opts.severity ?? AiErrorSeverity.ERROR;
    this.retryable = opts.retryable ?? false;
    this.phase = opts.phase;
    this.cause = opts.cause;
    this.meta = opts.meta;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AiError.prototype);
  }

  /**
   * Safe serialization for HTTP responses.
   * NEVER includes: stack traces, internal meta, cause chains.
   */
  toSafeJson(): SerializedAiError {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      retryable: this.retryable,
      phase: this.phase,
    };
  }

  /** HTTP status code for this error. */
  httpStatus(): number {
    return aiErrorToHttpStatus(this.code);
  }

  /** Create from an unknown thrown value (normalizes non-AiError errors). */
  static fromUnknown(err: unknown, phase?: string): AiError {
    if (err instanceof AiError) return err;

    const message = err instanceof Error ? err.message : String(err);
    return new AiError({
      code: AiErrorCode.INTERNAL_ERROR,
      message,
      severity: AiErrorSeverity.ERROR,
      retryable: false,
      phase,
      cause: err,
    });
  }

  // ─── Factory methods ─────────────────────────────────────────────────────

  static toolNotFound(name: string): AiError {
    return new AiError({
      code: AiErrorCode.TOOL_NOT_FOUND,
      message: `Tool not found: ${name}`,
      severity: AiErrorSeverity.WARNING,
      retryable: false,
      phase: 'tool',
    });
  }

  static toolSchemaViolation(toolName: string, direction: 'input' | 'output', details: string): AiError {
    return new AiError({
      code: AiErrorCode.TOOL_SCHEMA_VIOLATION,
      message: `Tool "${toolName}" ${direction} schema violation: ${details}`,
      severity: AiErrorSeverity.WARNING,
      retryable: false,
      phase: 'tool',
    });
  }

  static policyDenied(reason: string, tool?: string): AiError {
    return new AiError({
      code: AiErrorCode.POLICY_DENIED,
      message: tool
        ? `Policy denied tool "${tool}": ${reason}`
        : `Policy denied: ${reason}`,
      severity: AiErrorSeverity.WARNING,
      retryable: false,
      phase: 'policy',
    });
  }

  static tenantRequired(tool?: string): AiError {
    return new AiError({
      code: AiErrorCode.TENANT_REQUIRED,
      message: tool
        ? `Tool "${tool}" requires a valid tenant context`
        : 'Tenant context required',
      severity: AiErrorSeverity.WARNING,
      retryable: false,
      phase: 'policy',
    });
  }

  static capabilityMissing(required: string[], tool?: string): AiError {
    return new AiError({
      code: AiErrorCode.CAPABILITY_MISSING,
      message: tool
        ? `Tool "${tool}" requires capabilities: ${required.join(', ')}`
        : `Required capabilities missing: ${required.join(', ')}`,
      severity: AiErrorSeverity.WARNING,
      retryable: false,
      phase: 'policy',
    });
  }

  static providerNotConfigured(provider?: string): AiError {
    return new AiError({
      code: AiErrorCode.PROVIDER_NOT_CONFIGURED,
      message: provider
        ? `AI provider "${provider}" is not configured`
        : 'No AI provider is configured',
      severity: AiErrorSeverity.WARNING,
      retryable: false,
      phase: 'model',
    });
  }

  static skillNotFound(name: string): AiError {
    return new AiError({
      code: AiErrorCode.SKILL_NOT_FOUND,
      message: `Skill not found: ${name}`,
      severity: AiErrorSeverity.WARNING,
      retryable: false,
      phase: 'skill',
    });
  }

  static circuitOpen(model: string): AiError {
    return new AiError({
      code: AiErrorCode.CIRCUIT_OPEN,
      message: `Circuit breaker open for model "${model}" — too many recent failures`,
      severity: AiErrorSeverity.WARNING,
      retryable: true,
      phase: 'model',
    });
  }
}
