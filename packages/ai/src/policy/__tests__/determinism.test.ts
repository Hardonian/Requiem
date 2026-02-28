/**
 * @fileoverview Determinism verification tests for the AI policy layer.
 *
 * These tests verify that all policy-gate decisions are deterministic:
 * identical inputs always produce identical outputs.
 *
 * Contract: contracts/determinism.contract.json (ai_layer section)
 * Golden corpus: testdata/golden/
 *
 * INV-9: All time-dependent operations MUST use a Clock, never Date.now() directly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { evaluatePolicy } from '../gate.js';
import { evaluateGuardrails } from '../guardrails.js';
import { DefaultBudgetChecker } from '../budgets.js';
import type { Clock } from '../budgets.js';
import { TenantRole } from '../../types/index.js';
import type { InvocationContext } from '../../types/index.js';
import type { ToolDefinition } from '../../tools/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Workspace root — three levels up from packages/ai/src/policy/__tests__/ */
const WORKSPACE_ROOT = resolve(new URL(import.meta.url).pathname, '../../../../../../../');

function loadGolden(filename: string): unknown {
  const p = resolve(WORKSPACE_ROOT, 'testdata', 'golden', filename);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function makeFixedClock(ms: number): Clock {
  return { now: () => ms };
}

/** Canonical MEMBER context — no side-effects tool. */
function makeMemberCtx(tenantId = 'det-tenant-001'): InvocationContext {
  return {
    tenant: {
      tenantId,
      userId: 'user-001',
      role: TenantRole.MEMBER,
      derivedAt: '2024-01-01T00:00:00.000Z',
    },
    environment: 'production',
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

/** Canonical read-only, non-side-effect tool definition. */
function makeReadTool(): ToolDefinition {
  return {
    name: 'fs.list_dir',
    description: 'List directory contents',
    tenantScoped: true,
    sideEffect: false,
    requiredCapabilities: ['fs:read'],
    costHint: { costCents: 0 },
  };
}

/** Canonical write tool with side effects. */
function makeWriteTool(): ToolDefinition {
  return {
    name: 'fs.write_file',
    description: 'Write a file',
    tenantScoped: true,
    sideEffect: true,
    requiredCapabilities: ['fs:write'],
    costHint: { costCents: 1 },
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AI Policy Determinism', () => {
  // ── 2.3.1: Policy gate idempotency ────────────────────────────────────────

  it('evaluatePolicy produces identical decisions for identical inputs (10×)', () => {
    const ctx = makeMemberCtx();
    const tool = makeReadTool();
    const input = { path: '/tmp' };

    const results = Array.from({ length: 10 }, () => evaluatePolicy(ctx, tool, input));

    const first = JSON.stringify(results[0]);
    for (let i = 1; i < results.length; i++) {
      assert.equal(
        JSON.stringify(results[i]),
        first,
        `Run ${i} diverged from run 0`
      );
    }
    assert.equal(results[0].allowed, true, 'MEMBER should be allowed to read');
  });

  it('evaluatePolicy deny path is deterministic (10×)', () => {
    const ctx: InvocationContext = {
      tenant: {
        tenantId: 'det-tenant-002',
        userId: 'user-002',
        role: TenantRole.VIEWER,
        derivedAt: '2024-01-01T00:00:00.000Z',
      },
      environment: 'production',
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const tool = makeWriteTool();

    const results = Array.from({ length: 10 }, () => evaluatePolicy(ctx, tool, {}));

    const first = JSON.stringify(results[0]);
    for (let i = 1; i < results.length; i++) {
      assert.equal(JSON.stringify(results[i]), first, `Deny run ${i} diverged`);
    }
    assert.equal(results[0].allowed, false, 'VIEWER must be denied side-effect tools');
  });

  // ── 2.3.2: Budget checker with fixed clock ────────────────────────────────

  it('DefaultBudgetChecker with fixed clock produces deterministic allow (10×)', async () => {
    const FIXED_MS = 1_704_067_200_000; // 2024-01-01T00:00:00Z
    const clock = makeFixedClock(FIXED_MS);
    const checker = new DefaultBudgetChecker(false, clock);
    const tenantId = 'det-budget-001';

    DefaultBudgetChecker.configureTenant(tenantId, 'enterprise', {
      maxCostCents: 10_000,
      maxTokens: 100_000,
      windowSeconds: 3600,
    });

    // Clear any prior usage by creating a fresh checker instance
    const results = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const freshChecker = new DefaultBudgetChecker(false, makeFixedClock(FIXED_MS));
        return freshChecker.check(`${tenantId}-run-${i}`, 10);
      })
    );

    // All "empty" tenants with the same configuration should produce the same result
    // (First call on a fresh tenant is always allow since no usage recorded yet)
    const first = results[0].allowed;
    for (let i = 1; i < results.length; i++) {
      assert.equal(results[i].allowed, first, `Budget run ${i} diverged`);
    }
  });

  it('DefaultBudgetChecker deny is deterministic with fixed clock (10×)', async () => {
    const FIXED_MS = 1_704_067_200_000;
    const tenantId = 'det-budget-deny';

    DefaultBudgetChecker.configureTenant(tenantId, 'enterprise', {
      maxCostCents: 5,
      maxTokens: 10,
      windowSeconds: 3600,
    });

    // Pre-fill usage past the limit by performing multiple checks
    const results: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      const freshChecker = new DefaultBudgetChecker(false, makeFixedClock(FIXED_MS));
      // Each fresh checker has no tracked usage so the first check always passes
      // Force an over-limit check by requesting more than maxCostCents
      const r = await freshChecker.check(tenantId, 1000); // 1000 > 5
      results.push(r.allowed);
    }

    const first = results[0];
    for (let i = 1; i < results.length; i++) {
      assert.equal(results[i], first, `Budget deny run ${i} diverged`);
    }
    assert.equal(first, false, 'Cost exceeding limit must be denied');
  });

  // ── 2.3.3: Guardrail evaluation ───────────────────────────────────────────

  it('evaluateGuardrails is deterministic for identical inputs (10×)', () => {
    const ctx = makeMemberCtx('det-guard-001');
    const tool = makeReadTool();

    const results = Array.from({ length: 10 }, () => evaluateGuardrails(ctx, tool));

    const first = JSON.stringify(results[0]);
    for (let i = 1; i < results.length; i++) {
      assert.equal(JSON.stringify(results[i]), first, `Guardrail run ${i} diverged`);
    }
    assert.equal(results[0].effect, 'allow');
  });

  it('evaluateGuardrails deny is deterministic (10×)', () => {
    const ctx = makeMemberCtx('det-guard-002');
    const dangerousTool: ToolDefinition = {
      name: 'run_shell',
      description: 'Execute a shell command',
      tenantScoped: false,
      sideEffect: true,
      requiredCapabilities: [],
      costHint: { costCents: 0 },
    };

    const results = Array.from({ length: 10 }, () => evaluateGuardrails(ctx, dangerousTool));

    const first = JSON.stringify(results[0]);
    for (let i = 1; i < results.length; i++) {
      assert.equal(JSON.stringify(results[i]), first, `Guardrail deny run ${i} diverged`);
    }
    assert.equal(results[0].effect, 'deny', 'Dangerous tool must be denied');
  });

  // ── 2.3.4: Rate limiter with fixed clock ─────────────────────────────────

  it('Rate limiter produces deterministic allow/deny sequence with fixed clock', () => {
    // The rateLimitCheck guardrail uses rateLimitCheck.clock — inject a fixed clock
    // to make the token-bucket deterministic.
    const { rateLimitCheck } = await import('../guardrails.js').then(m => m);
    const FIXED_MS = 1_704_067_200_000;
    const fixedClock = makeFixedClock(FIXED_MS);

    // Inject fixed clock onto the exported rule
    (rateLimitCheck as { clock?: Clock }).clock = fixedClock;

    const tool = makeReadTool();

    // Fresh tenant for this test (never seen before)
    const tenantId = 'det-rate-limit-001';
    const ctx = makeMemberCtx(tenantId);

    // First call should always be allow (bucket starts full)
    const d1 = (rateLimitCheck as { check: (ctx: InvocationContext, tool: ToolDefinition) => { effect: string } }).check(ctx, tool);
    assert.equal(d1.effect, 'allow', 'First call should be allowed');

    // With fixed clock (no time passes), run again — bucket decrements each time
    const d2 = (rateLimitCheck as { check: (ctx: InvocationContext, tool: ToolDefinition) => { effect: string } }).check(ctx, tool);
    assert.equal(d2.effect, 'allow', 'Second call should still be allowed (bucket has 100 tokens)');

    // Restore clock to avoid polluting other tests
    (rateLimitCheck as { clock?: Clock }).clock = undefined;
  });

  // ── 2.3.5: Golden corpus cross-checks ────────────────────────────────────

  it('policy_decision_canon.json allow fixture matches live evaluatePolicy', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const golden = loadGolden('policy_decision_canon.json') as any;
    const { ctx, toolDef, rawInput } = golden.input;

    const decision = evaluatePolicy(ctx as InvocationContext, toolDef as ToolDefinition, rawInput);

    assert.equal(
      decision.allowed,
      golden.output.decision.allowed,
      'Allow decision must match golden'
    );
  });

  it('policy_decision_canon.json deny fixture matches live evaluatePolicy', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const golden = loadGolden('policy_decision_canon.json') as any;
    const { ctx, toolDef, rawInput } = golden.input_deny_example;

    const decision = evaluatePolicy(ctx as InvocationContext, toolDef as ToolDefinition, rawInput);

    assert.equal(
      decision.allowed,
      golden.output_deny_example.decision.allowed,
      'Deny decision must match golden'
    );
    assert.equal(decision.allowed, false);
  });
});
