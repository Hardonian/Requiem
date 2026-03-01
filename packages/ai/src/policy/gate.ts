/**
 * @fileoverview Policy gate — the security boundary for all AI tool invocations.
 *
 * INVARIANT: ALL tool calls MUST pass through evaluatePolicy before execution.
 * INVARIANT: Deny-by-default — any missing metadata results in deny.
 * INVARIANT: Tenant context is never derived from input; always from ctx.
 * INVARIANT: VIEWER role cannot execute tools with side effects.
 */

import type { InvocationContext } from '../types/index';
import { TenantRole, hasRequiredRole } from '../types/index';
import { hasCapabilities, capabilitiesFromRole } from './capabilities';
import { getBudgetChecker } from './budgets';
import type { ToolDefinition } from '../tools/types';
import { evaluateGuardrails } from './guardrails';

// ─── Policy Decision ──────────────────────────────────────────────────────────

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiredRole?: TenantRole;
}

// ─── Core Policy Evaluation ───────────────────────────────────────────────────

/**
 * Synchronous policy evaluation (fast path — no async budget check).
 * Budget checks are separate (async) and handled in evaluatePolicyWithBudget.
 */
export function evaluatePolicy(
  ctx: InvocationContext,
  toolDef: ToolDefinition,
  _input: unknown
): PolicyDecision {
  // 1. Tenant scoping check
  if (toolDef.tenantScoped) {
    if (!ctx.tenant || !ctx.tenant.tenantId) {
      return deny('Tool requires a valid tenant context', TenantRole.VIEWER);
    }
  }

  // 2. RBAC capability check
  if (toolDef.requiredCapabilities.length > 0) {
    const actorCaps = capabilitiesFromRole(ctx.tenant?.role ?? TenantRole.VIEWER);
    if (!hasCapabilities(actorCaps, toolDef.requiredCapabilities)) {
      const missing = toolDef.requiredCapabilities.filter(c => !actorCaps.includes(c));
      return deny(`Actor lacks required capabilities: ${missing.join(', ')}`);
    }
  }

  // 3. Side-effect restriction for VIEWER role
  if (toolDef.sideEffect && ctx.tenant) {
    if (!hasRequiredRole(ctx.tenant.role, TenantRole.MEMBER)) {
      return deny(`Role ${ctx.tenant.role} cannot execute tools with side effects`);
    }
  }

  // 4. Guardrail evaluation (runs after basic policy checks)
  const guardrailDecision = evaluateGuardrails(ctx, toolDef);
  if (guardrailDecision.effect === 'deny') {
    return deny(guardrailDecision.reason, guardrailDecision.requiredRole);
  }

  return allow();
}

/**
 * Async policy evaluation including budget check.
 * Used when budget enforcement is needed (every tool execution).
 */
export async function evaluatePolicyWithBudget(
  ctx: InvocationContext,
  toolDef: ToolDefinition,
  input: unknown
): Promise<PolicyDecision> {
  // Run sync checks first
  const syncDecision = evaluatePolicy(ctx, toolDef, input);
  if (!syncDecision.allowed) return syncDecision;

  // Budget check (only for tenanted calls in non-test environments)
  if (toolDef.tenantScoped && ctx.tenant && ctx.environment !== 'test') {
    const estimatedCostCents = toolDef.costHint?.costCents ?? 0;
    const checker = getBudgetChecker();
    const budgetResult = await checker.check(ctx.tenant.tenantId, estimatedCostCents);
    if (!budgetResult.allowed) {
      return deny(budgetResult.reason ?? 'Budget limit exceeded');
    }
  }

  return allow();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allow(): PolicyDecision {
  return { allowed: true, reason: 'All policy checks passed' };
}

function deny(reason: string, requiredRole?: TenantRole): PolicyDecision {
  return { allowed: false, reason, requiredRole };
}
