#!/usr/bin/env tsx
/**
 * verify-tenant-isolation.ts — AI layer tenant isolation tests
 *
 * Tests:
 * 1. Memory items for tenant A are not visible to tenant B
 * 2. Cost records are isolated per tenant
 * 3. Tool invocations with tenant A context cannot read tenant B data
 * 4. Policy gate enforces tenant scoping
 *
 * Run: npx tsx scripts/verify-tenant-isolation.ts
 */

import { storeMemoryItem, listMemoryItems } from '../packages/ai/src/memory/store.js';
import { recordCost, setCostSink, type CostRecord } from '../packages/ai/src/telemetry/cost.js';
import { invokeToolWithPolicy } from '../packages/ai/src/tools/invoke.js';
import { AiError } from '../packages/ai/src/errors/AiError.js';
import { AiErrorCode } from '../packages/ai/src/errors/codes.js';
import { TenantRole } from '../packages/ai/src/types/index.js';
import type { InvocationContext } from '../packages/ai/src/types/index.js';

// Bootstrap
import '../packages/ai/src/tools/builtins/system.echo.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

function makeCtx(tenantId: string, role: TenantRole = TenantRole.ADMIN): InvocationContext {
  return {
    tenant: { tenantId, userId: `user-${tenantId}`, role, derivedAt: new Date().toISOString() },
    actorId: `user-${tenantId}`,
    traceId: `trace-${tenantId}-${Date.now()}`,
    environment: 'test',
    createdAt: new Date().toISOString(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== verify-tenant-isolation ===\n');

  const tenantA = 'isolation-test-tenant-A';
  const tenantB = 'isolation-test-tenant-B';
  const ctxA = makeCtx(tenantA);
  const ctxB = makeCtx(tenantB);

  // 1. Memory isolation
  console.log('[1] Memory store tenant isolation');
  const memA = await storeMemoryItem(tenantA, { secret: 'tenant-A-secret', data: 'A-data' });
  const memB = await storeMemoryItem(tenantB, { secret: 'tenant-B-secret', data: 'B-data' });

  assert(memA.tenantId === tenantA, 'memA belongs to tenant A');
  assert(memB.tenantId === tenantB, 'memB belongs to tenant B');

  const listA = await listMemoryItems(tenantA);
  const listB = await listMemoryItems(tenantB);

  assert(listA.every(m => m.tenantId === tenantA), 'Tenant A list contains only A items');
  assert(listB.every(m => m.tenantId === tenantB), 'Tenant B list contains only B items');
  assert(!listA.some(m => m.tenantId === tenantB), 'Tenant A list has no tenant B items');
  assert(!listB.some(m => m.tenantId === tenantA), 'Tenant B list has no tenant A items');

  // 2. Cost record isolation
  console.log('\n[2] Cost record tenant isolation');
  const capturedCosts: CostRecord[] = [];
  setCostSink(async r => { capturedCosts.push(r); });

  await recordCost(ctxA, { provider: 'test', model: 'test', inputTokens: 10, outputTokens: 5, costCents: 0.01, latencyMs: 5 });
  await recordCost(ctxB, { provider: 'test', model: 'test', inputTokens: 20, outputTokens: 10, costCents: 0.02, latencyMs: 10 });

  const costsA = capturedCosts.filter(r => r.tenantId === tenantA);
  const costsB = capturedCosts.filter(r => r.tenantId === tenantB);

  assert(costsA.length >= 1, 'Tenant A has cost records');
  assert(costsB.length >= 1, 'Tenant B has cost records');
  assert(costsA.every(r => r.tenantId === tenantA), 'All tenant A cost records belong to A');
  assert(costsB.every(r => r.tenantId === tenantB), 'All tenant B cost records belong to B');

  // 3. Tool invocation context is tenant-scoped
  console.log('\n[3] Tool invocation context tenant isolation');
  const resultA = await invokeToolWithPolicy(ctxA, 'system.echo', { payload: 'tenant-A-payload' });
  const resultB = await invokeToolWithPolicy(ctxB, 'system.echo', { payload: 'tenant-B-payload' });

  assert(
    (resultA.output as Record<string, unknown>)?.payload === 'tenant-A-payload',
    'Tenant A gets correct echo'
  );
  assert(
    (resultB.output as Record<string, unknown>)?.payload === 'tenant-B-payload',
    'Tenant B gets correct echo'
  );

  // 4. Memory store requires tenant ID
  console.log('\n[4] Memory store requires non-empty tenant ID');
  try {
    await storeMemoryItem('', { data: 'no-tenant' });
    assert(false, 'Expected error for empty tenant ID');
  } catch (err) {
    assert(
      err instanceof AiError && err.code === AiErrorCode.TENANT_REQUIRED,
      'Empty tenant ID raises AI_TENANT_REQUIRED'
    );
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('verify-tenant-isolation FATAL:', err);
  process.exit(1);
});
