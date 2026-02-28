/**
 * @fileoverview Stable AI error codes.
 *
 * INVARIANT: These codes are part of the public API contract.
 * Never remove or rename a code — only add new ones.
 * Clients depend on these for programmatic error handling.
 */

export enum AiErrorCode {
  // ── General ──────────────────────────────────────────────────────────────
  INTERNAL_ERROR = 'AI_INTERNAL_ERROR',
  NOT_CONFIGURED = 'AI_NOT_CONFIGURED',
  TIMEOUT = 'AI_TIMEOUT',

  // ── Tool Errors ───────────────────────────────────────────────────────────
  TOOL_NOT_FOUND = 'AI_TOOL_NOT_FOUND',
  TOOL_SCHEMA_VIOLATION = 'AI_TOOL_SCHEMA_VIOLATION',
  TOOL_EXECUTION_FAILED = 'AI_TOOL_EXECUTION_FAILED',
  TOOL_ALREADY_REGISTERED = 'AI_TOOL_ALREADY_REGISTERED',
  TOOL_OUTPUT_INVALID = 'AI_TOOL_OUTPUT_INVALID',

  // ── Policy / Auth ─────────────────────────────────────────────────────────
  POLICY_DENIED = 'AI_POLICY_DENIED',
  TENANT_REQUIRED = 'AI_TENANT_REQUIRED',
  TENANT_MISMATCH = 'AI_TENANT_MISMATCH',
  UNAUTHORIZED = 'AI_UNAUTHORIZED',
  FORBIDDEN = 'AI_FORBIDDEN',
  CAPABILITY_MISSING = 'AI_CAPABILITY_MISSING',
  BUDGET_EXCEEDED = 'AI_BUDGET_EXCEEDED',
  ENV_RESTRICTION = 'AI_ENV_RESTRICTION',

  // ── MCP Protocol ─────────────────────────────────────────────────────────
  MCP_INVALID_REQUEST = 'AI_MCP_INVALID_REQUEST',
  MCP_METHOD_NOT_FOUND = 'AI_MCP_METHOD_NOT_FOUND',
  MCP_PARSE_ERROR = 'AI_MCP_PARSE_ERROR',

  // ── Skills ────────────────────────────────────────────────────────────────
  SKILL_NOT_FOUND = 'AI_SKILL_NOT_FOUND',
  SKILL_PRECONDITION_FAILED = 'AI_SKILL_PRECONDITION_FAILED',
  SKILL_POSTCONDITION_FAILED = 'AI_SKILL_POSTCONDITION_FAILED',
  SKILL_STEP_FAILED = 'AI_SKILL_STEP_FAILED',
  SKILL_ALREADY_REGISTERED = 'AI_SKILL_ALREADY_REGISTERED',
  SKILL_REQUIRED_TOOL_MISSING = 'AI_SKILL_REQUIRED_TOOL_MISSING',
  SKILL_ROLLBACK_FAILED = 'AI_SKILL_ROLLBACK_FAILED',

  // ── Model / Provider ─────────────────────────────────────────────────────
  PROVIDER_NOT_CONFIGURED = 'AI_PROVIDER_NOT_CONFIGURED',
  PROVIDER_UNAVAILABLE = 'AI_PROVIDER_UNAVAILABLE',
  PROVIDER_RATE_LIMITED = 'AI_PROVIDER_RATE_LIMITED',
  MODEL_NOT_FOUND = 'AI_MODEL_NOT_FOUND',
  CIRCUIT_OPEN = 'AI_CIRCUIT_OPEN',

  // ── Memory ────────────────────────────────────────────────────────────────
  MEMORY_STORE_FAILED = 'AI_MEMORY_STORE_FAILED',
  MEMORY_HASH_MISMATCH = 'AI_MEMORY_HASH_MISMATCH',
  MEMORY_NOT_FOUND = 'AI_MEMORY_NOT_FOUND',

  // ── Telemetry ─────────────────────────────────────────────────────────────
  TELEMETRY_WRITE_FAILED = 'AI_TELEMETRY_WRITE_FAILED',

  // ── Eval ──────────────────────────────────────────────────────────────────
  EVAL_CASE_NOT_FOUND = 'AI_EVAL_CASE_NOT_FOUND',
  EVAL_GOLDEN_MISMATCH = 'AI_EVAL_GOLDEN_MISMATCH',
  EVAL_HARNESS_FAILED = 'AI_EVAL_HARNESS_FAILED',
}

/**
 * Error severity levels.
 */
export enum AiErrorSeverity {
  /** Expected operational condition, not a bug */
  WARNING = 'warning',
  /** Operational error requiring attention */
  ERROR = 'error',
  /** System-level failure requiring immediate action */
  CRITICAL = 'critical',
}

/**
 * HTTP status code mapping for AI errors.
 */
export const AI_ERROR_HTTP_STATUS: Partial<Record<AiErrorCode, number>> = {
  [AiErrorCode.UNAUTHORIZED]: 401,
  [AiErrorCode.TENANT_REQUIRED]: 401,
  [AiErrorCode.FORBIDDEN]: 403,
  [AiErrorCode.POLICY_DENIED]: 403,
  [AiErrorCode.CAPABILITY_MISSING]: 403,
  [AiErrorCode.BUDGET_EXCEEDED]: 402,
  [AiErrorCode.TOOL_NOT_FOUND]: 404,
  [AiErrorCode.SKILL_NOT_FOUND]: 404,
  [AiErrorCode.MODEL_NOT_FOUND]: 404,
  [AiErrorCode.TOOL_SCHEMA_VIOLATION]: 400,
  [AiErrorCode.MCP_INVALID_REQUEST]: 400,
  [AiErrorCode.MCP_PARSE_ERROR]: 400,
  [AiErrorCode.CIRCUIT_OPEN]: 503,
  [AiErrorCode.PROVIDER_UNAVAILABLE]: 503,
  [AiErrorCode.PROVIDER_RATE_LIMITED]: 429,
  [AiErrorCode.INTERNAL_ERROR]: 500,
};

export function aiErrorToHttpStatus(code: AiErrorCode): number {
  return AI_ERROR_HTTP_STATUS[code] ?? 500;
}
