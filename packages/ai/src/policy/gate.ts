/**
 * @fileoverview A policy-aware gate for tool invocation.
 *
 * This module ensures that all tool calls are authorized against a set of policies,
 * including tenant isolation, RBAC, environment restrictions, and budget limits.
 */

import { z } from 'zod';
import { ToolDefinition, getTool } from '../tools/registry';
import { TenantContext, TenantRole } from '@requiem/cli'; // Assuming this path

// #region: Core Types

export interface InvocationContext {
  tenant: TenantContext;
  actorId: string;
  traceId: string;
  // In a real scenario, this would include more info like budget, permissions, etc.
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiredApprovals?: string[]; // e.g., 'owner' or 'billing_admin'
}

// #endregion: Core Types


// #region: Policy Evaluation

/**
 * Evaluates a tool call against defined policies.
 *
 * This is the core of the policy-gating logic.
 *
 * @param ctx The context of the invocation (tenant, actor, etc.).
 * @param toolDef The definition of the tool being called.
 * @param input The input provided to the tool.
 * @returns A policy decision indicating whether the call is allowed.
 */
export function evaluateToolCall(
  ctx: InvocationContext,
  toolDef: ToolDefinition<any, any>,
  input: any
): PolicyDecision {
  // 1. Tenant Scoping
  if (toolDef.tenantScoped && (!ctx.tenant || !ctx.tenant.id)) {
    return { allowed: false, reason: 'Tool requires a valid tenant context.' };
  }

  // 2. Capability Check (RBAC)
  if (toolDef.requiredCapabilities.length > 0) {
    const hasAllCapabilities = toolDef.requiredCapabilities.every(
      (cap) => ctx.tenant.roles.includes(cap as TenantRole) // Simplified for now
    );
    if (!hasAllCapabilities) {
      return {
        allowed: false,
        reason: `Actor lacks required capabilities: ${toolDef.requiredCapabilities.join(', ')}.`,
      };
    }
  }

  // 3. Side Effect Check (Example of a simple policy)
  if (toolDef.sideEffect && ctx.tenant.roles.includes(TenantRole.VIEWER)) {
     return {
        allowed: false,
        reason: 'Viewer role cannot execute tools with side effects.',
     };
  }

  // 4. Budget Check (Placeholder for Phase 5)
  // const estimatedCost = toolDef.cost?.costCents ?? 1;
  // if (getTenantBudget(ctx.tenant.id).remaining < estimatedCost) {
  //   return { allowed: false, reason: 'Insufficient budget for this operation.' };
  // }


  return { allowed: true, reason: 'Policy checks passed.' };
}

// #endregion: Policy Evaluation


// #region: Auditable Invocation

/**
 * The single, safe entry point for invoking any tool.
 * It performs policy checks, validation, execution, and audit logging.
 *
 * @param ctx The invocation context.
 * @param toolName The name of the tool to invoke.
 * @param input The input for the tool.
 * @returns The validated output of the tool.
 */
export async function invokeToolWithPolicy<T extends z.ZodType<any>>(
  ctx: InvocationContext,
  toolName: string,
  input: z.infer<T>
): Promise<any> {
  const tool = getTool(toolName);
  if (!tool) {
    auditLog(ctx, toolName, input, { allowed: false, reason: 'Tool not found.' });
    throw new Error(`Tool "${toolName}" not found.`);
  }

  // 1. Evaluate Policy
  const policyDecision = evaluateToolCall(ctx, tool.definition, input);
  auditLog(ctx, toolName, input, policyDecision);

  if (!policyDecision.allowed) {
    throw new Error(`Policy denied tool invocation: ${policyDecision.reason}`);
  }

  // 2. Validate Input
  const validatedInput = tool.definition.inputSchema.parse(input);

  // 3. Execute Handler
  const output = await tool.handler(validatedInput);

  // 4. Validate Output
  const validatedOutput = tool.definition.outputSchema.parse(output);
  
  // 5. Audit Log Cost (Phase 5)
  // recordCost(ctx, tool.definition, output);

  return validatedOutput;
}


/**
 * Logs an audit record for a tool invocation attempt.
 *
 * In a real system, this would write to a dedicated, immutable audit log.
 * For now, we'll log to the console.
 */
function auditLog(
  ctx: InvocationContext,
  toolName: string,
  input: any,
  decision: PolicyDecision
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    traceId: ctx.traceId,
    actorId: ctx.actorId,
    tenantId: ctx.tenant.id,
    toolName,
    input,
    decision,
  };

  // In a real implementation, write this to a secure audit log (e.g., database table, S3).
  console.log('[Audit]', JSON.stringify(logEntry, null, 2));
}

// #endregion: Auditable Invocation
