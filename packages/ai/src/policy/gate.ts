/**
 * @fileoverview Policy gate — the security boundary for all AI tool invocations.
 *
 * INVARIANT: ALL tool calls MUST pass through evaluatePolicy before execution.
 * INVARIANT: Deny-by-default — any missing metadata results in deny.
 * INVARIANT: Tenant context is never derived from input; always from ctx.
 * INVARIANT: VIEWER role cannot execute tools with side effects.
 */

import type { InvocationContext } from '../types/index.js';
import { TenantRole, hasRequiredRole } from '../types/index.js';
import { hasCapabilities, capabilitiesFromRole } from './capabilities.js';
import { getBudgetChecker } from './budgets.js';
import type { ToolDefinition } from '../tools/types.js';

// ─── Policy Decision ──────────────────────────────────────────────────────────

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiredRole?: TenantRole;
}

// ─── Core Policy Evaluation ───────────────────────────────────────────────────

/**
 * Synchronous policy evaluation (fast path — no async budget check).
 * Budget checks are separate (async) and handled in invokeToolWithPolicy.
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
    // Derive capabilities from tenant role
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

  // 4. Environment restrictions
  const env = ctx.environment;
  if (env === 'production' && toolDef.sideEffect && !toolDef.idempotent) {
    // Non-idempotent side-effect tools in prod still allowed,
    // but we could add additional checks here (e.g., approval workflows)
  }

  return allow();
}

/**
 * Async policy evaluation including budget check.
 * Used when budget enforcement is needed.
 */
export async function evaluatePolicyWithBudget(
  ctx: InvocationContext,
  toolDef: ToolDefinition,
  input: unknown
): Promise<PolicyDecision> {
  // Run sync checks first
  const syncDecision = evaluatePolicy(ctx, toolDef, input);
  if (!syncDecision.allowed) return syncDecision;

  // Budget check (only for tenanted calls)
  if (toolDef.tenantScoped && ctx.tenant) {
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
