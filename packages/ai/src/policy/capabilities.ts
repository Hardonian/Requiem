/**
 * @fileoverview Capability map for the AI control-plane.
 *
 * Capabilities are fine-grained permissions that gate tool access.
 * Roles map to capability sets — administrators have the superset.
 *
 * INVARIANT: Side-effect tools require at least 'tools:write' capability.
 * INVARIANT: Admin-only tools require 'ai:admin' capability.
 */

import { TenantRole } from '../types/index.js';

// ─── Capability Definitions ───────────────────────────────────────────────────

/**
 * All capability strings recognized by the system.
 * Add new capabilities here before using in ToolDefinition.requiredCapabilities.
 */
export const Capabilities = {
  // AI tool access
  TOOLS_READ: 'tools:read',
  TOOLS_WRITE: 'tools:write',
  TOOLS_ADMIN: 'tools:admin',

  // AI model/provider access
  AI_GENERATE: 'ai:generate',
  AI_ADMIN: 'ai:admin',

  // Memory access
  MEMORY_READ: 'memory:read',
  MEMORY_WRITE: 'memory:write',

  // Skill execution
  SKILLS_RUN: 'skills:run',
  SKILLS_ADMIN: 'skills:admin',

  // Cost/billing
  COST_READ: 'cost:read',
  COST_ADMIN: 'cost:admin',

  // Eval harness
  EVAL_RUN: 'eval:run',
  EVAL_ADMIN: 'eval:admin',
} as const;

export type Capability = typeof Capabilities[keyof typeof Capabilities];

// ─── Role → Capability Mapping ────────────────────────────────────────────────

/**
 * Default capability grant for each tenant role.
 * Higher roles include all capabilities of lower roles.
 */
const ROLE_CAPABILITIES: Record<TenantRole, readonly Capability[]> = {
  [TenantRole.VIEWER]: [
    Capabilities.TOOLS_READ,
    Capabilities.MEMORY_READ,
    Capabilities.COST_READ,
  ],
  [TenantRole.MEMBER]: [
    Capabilities.TOOLS_READ,
    Capabilities.TOOLS_WRITE,
    Capabilities.AI_GENERATE,
    Capabilities.MEMORY_READ,
    Capabilities.MEMORY_WRITE,
    Capabilities.SKILLS_RUN,
    Capabilities.COST_READ,
    Capabilities.EVAL_RUN,
  ],
  [TenantRole.ADMIN]: [
    Capabilities.TOOLS_READ,
    Capabilities.TOOLS_WRITE,
    Capabilities.TOOLS_ADMIN,
    Capabilities.AI_GENERATE,
    Capabilities.AI_ADMIN,
    Capabilities.MEMORY_READ,
    Capabilities.MEMORY_WRITE,
    Capabilities.SKILLS_RUN,
    Capabilities.SKILLS_ADMIN,
    Capabilities.COST_READ,
    Capabilities.COST_ADMIN,
    Capabilities.EVAL_RUN,
    Capabilities.EVAL_ADMIN,
  ],
  [TenantRole.OWNER]: [
    // Owner gets all capabilities
    Capabilities.TOOLS_READ,
    Capabilities.TOOLS_WRITE,
    Capabilities.TOOLS_ADMIN,
    Capabilities.AI_GENERATE,
    Capabilities.AI_ADMIN,
    Capabilities.MEMORY_READ,
    Capabilities.MEMORY_WRITE,
    Capabilities.SKILLS_RUN,
    Capabilities.SKILLS_ADMIN,
    Capabilities.COST_READ,
    Capabilities.COST_ADMIN,
    Capabilities.EVAL_RUN,
    Capabilities.EVAL_ADMIN,
  ],
};

/**
 * Get effective capabilities for a given role.
 */
export function getCapabilitiesForRole(role: TenantRole): readonly Capability[] {
  return ROLE_CAPABILITIES[role] ?? [];
}

/**
 * Check if a set of actor capabilities satisfies all required capabilities.
 */
export function hasCapabilities(
  actorCapabilities: readonly string[],
  required: readonly string[]
): boolean {
  return required.every(cap => actorCapabilities.includes(cap));
}

/**
 * Derive actor capabilities from their tenant role.
 */
export function capabilitiesFromRole(role: TenantRole): string[] {
  return [...getCapabilitiesForRole(role)];
}
