/**
 * @fileoverview Tool invocation entry point.
 *
 * INVARIANT: All tool invocations MUST use invokeToolWithPolicy.
 * INVARIANT: Direct handler calls bypass the policy gate — FORBIDDEN in app paths.
 * INVARIANT: Tenant context is ALWAYS mandatory (no implicit default).
 * INVARIANT: ctx.tenant.tenantId MUST be a non-empty string — no fallback.
 *
 * This module provides the legacy-compatible `invokeToolWithPolicy` wrapper
 * that delegates to the full ExecutionEnvelope pipeline in executor.ts.
 */

import { executeToolEnvelope } from './executor';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import type { InvocationContext } from '../types/index';
import type { ToolInvocationResult } from './types';

/**
 * Invoke a tool by name, enforcing:
 * 1. Tenant isolation hard stop (tenant required, no fallback)
 * 2. Policy gate (RBAC + budget)
 * 3. Input schema validation
 * 4. Recursion depth guard
 * 5. Replay cache (deterministic tools)
 * 6. Timeout-bounded execution
 * 7. Output schema validation
 * 8. Audit log persistence
 * 9. Execution envelope return
 *
 * Throws AiError on any failure.
 */
export async function invokeToolWithPolicy(
  ctx: InvocationContext,
  toolName: string,
  input: unknown,
  version?: string
): Promise<ToolInvocationResult> {
  // Tenant isolation hard stop: tenant_id is MANDATORY
  // No fallback to 'system', 'global', or undefined
  if (!ctx.tenant?.tenantId) {
    throw new AiError({
      code: AiErrorCode.TENANT_REQUIRED,
      message: `Tool "${toolName}" requires a valid tenant context — no implicit default`,
      phase: 'invoke',
    });
  }

  const envelope = await executeToolEnvelope(ctx, toolName, input, { version });

  return {
    output: envelope.result,
    latencyMs: envelope.duration_ms,
    toolName,
    toolVersion: envelope.tool_version,
  };
}
