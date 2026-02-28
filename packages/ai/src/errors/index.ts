/**
 * @fileoverview Public exports for the AI error module.
 */

export { AiErrorCode, AiErrorSeverity, aiErrorToHttpStatus, AI_ERROR_HTTP_STATUS } from './codes';
export { AiError, type AiErrorOptions } from './AiError';

// Re-export SerializedAiError for convenience
export type { SerializedAiError } from '../types/index';

/**
 * Build a standard JSON API envelope from an AiError.
 * Safe to send directly to clients.
 */
import { AiError } from './AiError';
import type { ApiEnvelope } from '../types/index';

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
