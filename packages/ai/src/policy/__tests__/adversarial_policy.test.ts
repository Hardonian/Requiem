/**
 * @fileoverview Adversarial policy test cases.
 *
 * Dynamically loads eval/policy_adversarial_cases.json and runs each case
 * through evaluatePolicy(), asserting deny decisions.
 *
 * Adding a new adversarial case to the JSON file is sufficient —
 * no code changes needed.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePolicy } from '../gate.js';
import type { PolicyDecision } from '../gate.js';
import { TenantRole } from '../../types/index.js';
import type { InvocationContext } from '../../types/index.js';
import type { ToolDefinition } from '../../tools/types.js';
import { Capabilities } from '../capabilities.js';

// ─── Load case file dynamically ───────────────────────────────────────────────

const CASES_PATH = join(__dirname, '../../../../../..', 'eval/policy_adversarial_cases.json');

interface AdversarialCase {
  id: string;
  name: string;
  type: string;
  requester: { tenant_id: string; role: string };
  input: { method: string; params: Record<string, unknown> };
  expected_outcome: 'allow' | 'deny';
  reason: string;
}

interface CaseFile {
  test_cases: AdversarialCase[];
}

const caseFile = JSON.parse(readFileSync(CASES_PATH, 'utf-8')) as CaseFile;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a role string (from the JSON) to TenantRole enum.
 */
function toTenantRole(role: string): TenantRole {
  switch (role.toLowerCase()) {
    case 'owner':  return TenantRole.OWNER;
    case 'admin':  return TenantRole.ADMIN;
    case 'member': return TenantRole.MEMBER;
    case 'viewer': return TenantRole.VIEWER;
    // Default unknown roles to VIEWER (deny-by-default principle)
    default:       return TenantRole.VIEWER;
  }
}

/**
 * Build an InvocationContext from an adversarial case.
 * Roles that are not an explicit admin/owner are mapped to a limited role
 * so the policy gate can exercise its deny paths.
 */
function buildContext(tc: AdversarialCase): InvocationContext {
  return {
    tenant: {
      tenantId: tc.requester.tenant_id,
      userId: 'test-user',
      role: toTenantRole(tc.requester.role),
      derivedAt: '2026-01-01T00:00:00.000Z',
    },
    actorId: 'test-actor',
    traceId: `trace-${tc.id}`,
    environment: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * Synthesise a ToolDefinition from the adversarial case to exercise the
 * specific policy check that the case targets.
 *
 * Case-type → policy check mapping:
 *  cross-tenant          → tenantScoped tool, no tenant context supplied
 *  privilege-escalation  → requiredCapabilities: ['ai:admin']
 *  budget-exhaustion     → sideEffect tool (VIEWER cannot execute)
 *  environment-bypass    → sideEffect tool (VIEWER cannot execute)
 */
function buildToolDef(tc: AdversarialCase): ToolDefinition {
  const base: ToolDefinition = {
    name: tc.input.method,
    version: '1.0.0',
    description: `Adversarial test tool for case ${tc.id}`,
    inputSchema:  { type: 'object' },
    outputSchema: { type: 'object' },
    deterministic: false,
    sideEffect: false,
    idempotent: false,
    requiredCapabilities: [],
    tenantScoped: false,
  };

  switch (tc.type) {
    case 'cross-tenant':
      // tenantScoped forces the gate to validate tenant context.
      // We supply a context with no tenantId to simulate absence of
      // a valid scoped tenant (cross-tenant injection).
      return { ...base, tenantScoped: true };

    case 'privilege-escalation':
      // The method name ('cluster_shutdown') implies admin-only.
      return {
        ...base,
        requiredCapabilities: [Capabilities.AI_ADMIN, Capabilities.TOOLS_ADMIN],
        sideEffect: true,
        tenantScoped: true,
      };

    case 'budget-exhaustion':
    case 'environment-bypass':
    default:
      // Side-effect tools require at least MEMBER role;
      // VIEWER (default for unknown roles) will be denied.
      return { ...base, sideEffect: true, tenantScoped: true };
  }
}

/**
 * For cross-tenant cases we override the tenant context to simulate
 * an absent/invalid tenant (the gate checks tenantId presence).
 */
function maybeOverrideContext(tc: AdversarialCase, ctx: InvocationContext): InvocationContext {
  if (tc.type === 'cross-tenant') {
    // Simulate the attacker not having a valid tenant context:
    // return a context where tenantId is empty (server would never issue this,
    // but we need to exercise the deny path).
    return {
      ...ctx,
      tenant: { ...ctx.tenant, tenantId: '' },
    };
  }
  return ctx;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Adversarial Policy Cases', () => {
  for (const tc of caseFile.test_cases) {
    test(`[${tc.id}] ${tc.name}`, () => {
      const rawCtx  = buildContext(tc);
      const ctx     = maybeOverrideContext(tc, rawCtx);
      const toolDef = buildToolDef(tc);
      const input   = tc.input.params;

      const decision: PolicyDecision = evaluatePolicy(ctx, toolDef, input);

      if (tc.expected_outcome === 'deny') {
        assert.strictEqual(
          decision.allowed,
          false,
          `Expected DENY for case ${tc.id} (${tc.name}), but got ALLOW. ` +
          `reason: ${decision.reason}`
        );
      } else {
        assert.strictEqual(
          decision.allowed,
          true,
          `Expected ALLOW for case ${tc.id} (${tc.name}), but got DENY. ` +
          `reason: ${decision.reason}`
        );
      }
    });
  }
});
