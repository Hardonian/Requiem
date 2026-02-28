/**
 * @fileoverview Tool invocation entry point.
 *
 * INVARIANT: All tool invocations MUST use invokeToolWithPolicy.
 * Direct handler calls bypass the policy gate and are FORBIDDEN in app paths.
 */

import { getTool } from './registry.js';
import { validateInputOrThrow, validateOutputOrThrow } from './schema.js';
import { evaluatePolicy } from '../policy/gate.js';
import { AiError } from '../errors/AiError.js';
import { writeAuditRecord } from '../telemetry/audit.js';
import type { InvocationContext } from '../types/index.js';
import type { ToolInvocationResult } from './types.js';

/**
 * Invoke a tool by name, enforcing:
 * 1. Tool existence
 * 2. Policy gate (tenant, RBAC, budget, env)
 * 3. Input schema validation
 * 4. Handler execution
 * 5. Output schema validation
 * 6. Audit log
 *
 * Throws AiError on any failure.
 */
export async function invokeToolWithPolicy(
  ctx: InvocationContext,
  toolName: string,
  input: unknown,
  version?: string
): Promise<ToolInvocationResult> {
  const startMs = Date.now();

  // 1. Look up tool
  const registered = getTool(toolName, version);
  if (!registered) {
    await writeAuditRecord({
      toolName,
      toolVersion: version ?? 'unknown',
      actorId: ctx.actorId,
      tenantId: ctx.tenant?.tenantId ?? null,
      traceId: ctx.traceId,
      decision: 'deny',
      reason: 'Tool not found',
      latencyMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    });
    throw AiError.toolNotFound(toolName);
  }

  const { definition, handler } = registered;

  // 2. Policy gate
  const decision = evaluatePolicy(ctx, definition, input);
  await writeAuditRecord({
    toolName,
    toolVersion: definition.version,
    actorId: ctx.actorId,
    tenantId: ctx.tenant?.tenantId ?? null,
    traceId: ctx.traceId,
    decision: decision.allowed ? 'allow' : 'deny',
    reason: decision.reason,
    latencyMs: null,
    timestamp: new Date().toISOString(),
  });

  if (!decision.allowed) {
    throw AiError.policyDenied(decision.reason, toolName);
  }

  // 3. Validate input
  validateInputOrThrow(definition, input);

  // 4. Execute handler
  let output: unknown;
  try {
    output = await handler(ctx, input);
  } catch (err) {
    const aiErr = AiError.fromUnknown(err, 'tool');
    throw aiErr;
  }

  // 5. Validate output
  validateOutputOrThrow(definition, output);

  const latencyMs = Date.now() - startMs;

  return {
    output,
    latencyMs,
    toolName,
    toolVersion: definition.version,
  };
}
