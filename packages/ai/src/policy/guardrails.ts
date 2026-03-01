/**
 * @fileoverview Policy Guardrail Definitions
 *
 * Explicit allow/deny rules for tool execution.
 * These guardrails are evaluated by the policy gate.
 *
 * INVARIANT: Guardrails are evaluated in order - first match wins.
 * INVARIANT: Deny-by-default - if no rule matches, the request is denied.
 * INVARIANT: All guardrails MUST be documented and tested.
 */

import { TenantRole } from '../types/index';
import type { ToolDefinition } from '../tools/types';
import type { InvocationContext } from '../types/index';
import { getCapabilitiesForRole } from './capabilities';
import { Clock, defaultClock } from './budgets';

// ─── Token Bucket Rate Limiter ────────────────────────────────────────────────

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const rateLimitBuckets = new Map<string, TokenBucket>();

/**
 * Token-bucket rate limiter.
 * Default: 100 requests per 60-second window per tenant.
 */
function checkRateLimit(
  tenantId: string,
  maxTokens = 100,
  windowMs = 60_000,
  clock: Clock = defaultClock
): boolean {
  const now = clock.now();
  let bucket = rateLimitBuckets.get(tenantId);

  if (!bucket) {
    bucket = { tokens: maxTokens - 1, lastRefill: now };
    rateLimitBuckets.set(tenantId, bucket);
    return true;
  }

  // Refill tokens proportionally to elapsed time
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor((elapsed / windowMs) * maxTokens);

  if (refill > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

// ─── Guardrail Types ───────────────────────────────────────────────────────────

/**
 * A policy guardrail rule.
 */
export interface GuardrailRule {
  /** Unique identifier for this rule */
  id: string;
  /** Human-readable description */
  description: string;
  /** Priority (lower = evaluated first) */
  priority: number;
  /** Check function - returns decision */
  check: (ctx: InvocationContext, tool: ToolDefinition) => GuardrailDecision;
}

/**
 * Result of a guardrail check.
 */
export interface GuardrailDecision {
  /** Whether to allow or deny */
  effect: 'allow' | 'deny';
  /** Reason for the decision */
  reason: string;
  /** Optional: required role if denied due to role */
  requiredRole?: TenantRole;
}

// ─── Built-in Guardrail Rules ─────────────────────────────────────────────────

/**
 * Guardrail: Require valid tenant context for tenant-scoped tools.
 */
export const requireTenantContext: GuardrailRule = {
  id: 'GR_TENANT_001',
  description: 'Require valid tenant context for tenant-scoped tools',
  priority: 100,
  check: (ctx, tool) => {
    if (tool.tenantScoped && (!ctx.tenant || !ctx.tenant.tenantId)) {
      return {
        effect: 'deny',
        reason: `Tool "${tool.name}" requires a valid tenant context but none was provided`,
      };
    }
    return { effect: 'allow', reason: 'Tenant context present' };
  },
};

/**
 * Guardrail: Require minimum role for side-effect tools.
 * VIEWER role cannot execute tools with side effects.
 */
export const requireRoleForSideEffects: GuardrailRule = {
  id: 'GR_RBAC_001',
  description: 'Require MEMBER+ role for side-effect tools',
  priority: 200,
  check: (ctx, tool) => {
    if (tool.sideEffect) {
      const roleHierarchy: Record<TenantRole, number> = {
        [TenantRole.VIEWER]: 0,
        [TenantRole.MEMBER]: 1,
        [TenantRole.ADMIN]: 2,
        [TenantRole.OWNER]: 3,
      };
      const currentLevel = roleHierarchy[ctx.tenant?.role ?? TenantRole.VIEWER];
      if (currentLevel < 1) {
        return {
          effect: 'deny',
          reason: `Role "${ctx.tenant?.role}" cannot execute tools with side effects (requires MEMBER+)`,
          requiredRole: TenantRole.MEMBER,
        };
      }
    }
    return { effect: 'allow', reason: 'Role check passed' };
  },
};

/**
 * Guardrail: Require specific capabilities.
 */
export const requireCapabilities: GuardrailRule = {
  id: 'GR_CAP_001',
  description: 'Require required capabilities for tool execution',
  priority: 150,
  check: (ctx, tool) => {
    if (tool.requiredCapabilities.length > 0) {
      const actorCaps = getCapabilitiesForRole(ctx.tenant?.role ?? TenantRole.VIEWER) as readonly string[];
      const missing = tool.requiredCapabilities.filter(c => !actorCaps.includes(c));

      if (missing.length > 0) {
        return {
          effect: 'deny',
          reason: `Actor lacks required capabilities: ${missing.join(', ')}`,
        };
      }
    }
    return { effect: 'allow', reason: 'Capabilities check passed' };
  },
};

/**
 * Guardrail: Deny dangerous tool combinations.
 */
export const denyDangerousTools: GuardrailRule = {
  id: 'GR_DENY_001',
  description: 'Deny known dangerous tool combinations',
  priority: 50, // High priority - checked first
  check: (_ctx, tool) => {
    // Example: Block tools that could execute arbitrary code
    const dangerousPatterns = ['eval', 'exec', 'run_shell'];
    const isDangerous = dangerousPatterns.some(p =>
      tool.name.toLowerCase().includes(p)
    );

    if (isDangerous) {
      return {
        effect: 'deny',
        reason: `Tool "${tool.name}" matches dangerous pattern and is blocked by policy`,
      };
    }

    return { effect: 'allow', reason: 'Not a dangerous tool' };
  },
};

/**
 * Guardrail: Token-bucket rate limiter.
 * Config keys: maxTokens (default 100), windowMs (default 60000).
 */
export const rateLimitCheck: GuardrailRule & { clock?: Clock } = {
  id: 'GR_RATE_001',
  description: 'Rate limiting guardrail (token bucket, 100 req/min per tenant)',
  priority: 300,
  check: (ctx, _tool) => {
    const tenantId = ctx.tenant?.tenantId;
    if (!tenantId) {
      // No tenant — allow (anonymous calls are governed elsewhere)
      return { effect: 'allow', reason: 'No tenant context; rate limit skipped' };
    }
    const allowed = checkRateLimit(
      tenantId,
      /* maxTokens */ 100,
      /* windowMs  */ 60_000,
      rateLimitCheck.clock ?? defaultClock
    );
    if (!allowed) {
      return {
        effect: 'deny',
        reason: `Rate limit exceeded for tenant ${tenantId}`,
      };
    }
    return { effect: 'allow', reason: 'Rate limit check passed' };
  },
};

// ─── Guardrail Registry ───────────────────────────────────────────────────────

/**
 * All enabled guardrail rules.
 * Order matters - rules are evaluated by priority (ascending).
 */
export const GUARDRAIL_RULES: GuardrailRule[] = [
  denyDangerousTools,     // First: block dangerous tools
  requireTenantContext,   // Second: require tenant
  requireCapabilities,    // Third: check capabilities
  requireRoleForSideEffects, // Fourth: check role for side-effects
  rateLimitCheck,        // Fifth: rate limiting
];

/**
 * Evaluate all guardrails against a request.
 * Returns the first deny decision, or allow if all pass.
 */
export function evaluateGuardrails(
  ctx: InvocationContext,
  tool: ToolDefinition
): GuardrailDecision {
  // Sort by priority
  const sortedRules = [...GUARDRAIL_RULES].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    const decision = rule.check(ctx, tool);

    if (decision.effect === 'deny') {
      return {
        ...decision,
        reason: `[${rule.id}] ${decision.reason}`,
      };
    }
  }

  return { effect: 'allow', reason: 'All guardrails passed' };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export type { InvocationContext, ToolDefinition };
