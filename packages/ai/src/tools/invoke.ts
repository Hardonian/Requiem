/**
 * @fileoverview Tool invocation entry point.
 *
 * INVARIANT: All tool invocations MUST use invokeToolWithPolicy.
 * INVARIANT: Direct handler calls bypass the policy gate — FORBIDDEN in app paths.
 * INVARIANT: tenantScoped tools require a non-empty tenantId (enforced as POLICY_DENIED).
 * INVARIANT: tenantScoped: false tools may be called without a tenant context.
 *
 * This module provides the legacy-compatible `invokeToolWithPolicy` wrapper
 * that delegates to the full ExecutionEnvelope pipeline in executor.ts.
 */

import { executeToolEnvelope } from './executor';
import { getTool, SYSTEM_TENANT } from './registry';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import type { InvocationContext } from '../types/index';
import type { ToolInvocationResult } from './types';

/**
 * Invoke a tool by name, enforcing:
 * 1. Tenant isolation hard stop for tenantScoped tools (enforced as POLICY_DENIED)
 *    tenantScoped: false tools bypass tenant validation and run in system context.
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
  const tenantId = ctx.tenant?.tenantId;

  // Resolve tool definition to determine tenantScoped flag before tenant check.
  // Try tenant registry first; fall back to system registry for built-ins.
  const toolDef =
    (tenantId ? getTool(toolName, tenantId, version) : undefined) ??
    getTool(toolName, SYSTEM_TENANT, version);

  if (toolDef) {
    // Tool found — enforce tenant requirement based on tenantScoped flag.
    if (toolDef.definition.tenantScoped && !tenantId) {
      throw new AiError({
        code: AiErrorCode.POLICY_DENIED,
        message: `Tool "${toolName}" requires a tenant context (tenantScoped: true)`,
        phase: 'invoke',
      });
    }
  } else {
    // Tool not found — fall through to executor which will throw TOOL_NOT_FOUND.
    // For tenantScoped enforcement on unknown tools, check tenant presence.
    if (!tenantId) {
      throw new AiError({
        code: AiErrorCode.TENANT_REQUIRED,
        message: `Tool "${toolName}" requires a valid tenant context — no implicit default`,
        phase: 'invoke',
      });
    }
  }

  const envelope = await executeToolEnvelope(ctx, toolName, input, { version });

  return {
    output: envelope.result,
    latencyMs: envelope.duration_ms,
    toolName,
    toolVersion: envelope.tool_version,
  };
}
