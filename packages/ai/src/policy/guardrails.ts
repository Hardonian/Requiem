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
      const actorCaps = getCapabilitiesForRole(ctx.tenant?.role ?? TenantRole.VIEWER);
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
  check: (ctx, tool) => {
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
 * Guardrail: Rate limiting simulation.
 * In production, this would check against actual rate limits.
 */
export const rateLimitCheck: GuardrailRule = {
  id: 'GR_RATE_001',
  description: 'Rate limiting guardrail',
  priority: 300,
  check: (_ctx, _tool) => {
    // TODO: Implement actual rate limiting
    // For now, allow all (rate limiting is handled by budget system)
    return { effect: 'allow', reason: 'Rate limit not enforced (handled by budget)' };
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

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Get capabilities for a role.
 * (Duplicated from capabilities.ts to avoid circular deps)
 */
function getCapabilitiesForRole(role: TenantRole): string[] {
  const ROLE_CAPABILITIES: Record<TenantRole, string[]> = {
    [TenantRole.VIEWER]: [
      'tools:read',
      'memory:read',
      'cost:read',
    ],
    [TenantRole.MEMBER]: [
      'tools:read',
      'tools:write',
      'ai:generate',
      'memory:read',
      'memory:write',
      'skills:run',
      'cost:read',
      'eval:run',
    ],
    [TenantRole.ADMIN]: [
      'tools:read',
      'tools:write',
      'tools:admin',
      'ai:generate',
      'ai:admin',
      'memory:read',
      'memory:write',
      'skills:run',
      'skills:admin',
      'cost:read',
      'cost:admin',
      'eval:run',
      'eval:admin',
    ],
    [TenantRole.OWNER]: [
      'tools:read',
      'tools:write',
      'tools:admin',
      'ai:generate',
      'ai:admin',
      'memory:read',
      'memory:write',
      'skills:run',
      'skills:admin',
      'cost:read',
      'cost:admin',
      'eval:run',
      'eval:admin',
    ],
  };
  
  return ROLE_CAPABILITIES[role] ?? [];
}

// ─── Export ───────────────────────────────────────────────────────────────────

export type { InvocationContext, ToolDefinition };
