/**
 * Public exports for the AI error module.
 */

export { AiErrorCode, AiErrorSeverity, aiErrorToHttpStatus, AI_ERROR_HTTP_STATUS } from './codes.js';
export { AiError, type AiErrorOptions } from './AiError.js';

// Re-export SerializedAiError for convenience
export type { SerializedAiError } from '../types/index.js';

// Structured error exports
export * from './structured-errors.js';

/**
 * Build a standard JSON API envelope from an AiError.
 * Safe to send directly to clients.
 */
import { AiError } from './AiError.js';
import type { ApiEnvelope } from '../types/index.js';

export function errorEnvelope(err: AiError, trace_id?: string): ApiEnvelope<never> {
  return {
    ok: false,
    error: err.toSafeJson(),
    trace_id,
  };
}

export function successEnvelope<T>(data: T, trace_id?: string): ApiEnvelope<T> {
  return {
    ok: true,
    data,
    trace_id,
  };
}
