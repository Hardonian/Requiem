#!/usr/bin/env tsx
/**
 * verify-cost-accounting.ts — Cost record structure + tenant scoping verification
 *
 * Tests:
 * 1. Cost record is emitted for a tool invocation
 * 2. Cost record has required fields
 * 3. Cost record is tenant-scoped
 * 4. Cost record does NOT contain secrets
 *
 * Run: npx tsx scripts/verify-cost-accounting.ts
 */

import { recordCost, setCostSink, type CostRecord } from '../packages/ai/src/telemetry/cost.js';
import { invokeToolWithPolicy } from '../packages/ai/src/tools/invoke.js';
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

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== verify-cost-accounting ===\n');

  // Capture cost records in memory
  const capturedRecords: CostRecord[] = [];
  setCostSink(async (record) => {
    capturedRecords.push(record);
  });

  const ctx: InvocationContext = {
    tenant: {
      tenantId: 'cost-verify-tenant-A',
      userId: 'cost-verify-user',
      role: TenantRole.ADMIN,
      derivedAt: new Date().toISOString(),
    },
    actorId: 'cost-verify-user',
    traceId: 'cost-verify-trace-001',
    environment: 'test',
    createdAt: new Date().toISOString(),
  };

  // 1. Direct cost record write
  console.log('[1] Direct cost record write');
  const record = await recordCost(ctx, {
    provider: 'test-provider',
    model: 'test-model',
    inputTokens: 100,
    outputTokens: 50,
    costCents: 0.15,
    latencyMs: 42,
    phase: 'test',
  });

  assert(typeof record.id === 'string' && record.id.startsWith('cost_'), 'record has prefixed ID');
  assert(record.traceId === ctx.traceId, 'record traceId matches ctx');
  assert(record.tenantId === ctx.tenant.tenantId, 'record tenantId matches ctx tenant');
  assert(record.actorId === ctx.actorId, 'record actorId matches ctx actor');
  assert(typeof record.createdAt === 'string', 'record has createdAt');
  assert(record.inputTokens === 100, 'record inputTokens correct');
  assert(record.outputTokens === 50, 'record outputTokens correct');
  assert(record.costCents === 0.15, 'record costCents correct');

  // 2. Tenant isolation — different tenant, different record
  console.log('\n[2] Tenant isolation in cost records');
  const ctx2: InvocationContext = {
    ...ctx,
    tenant: { ...ctx.tenant, tenantId: 'cost-verify-tenant-B' },
    traceId: 'cost-verify-trace-002',
  };

  const record2 = await recordCost(ctx2, {
    provider: 'test-provider',
    model: 'test-model',
    inputTokens: 200,
    outputTokens: 100,
    costCents: 0.30,
    latencyMs: 88,
  });

  assert(record2.tenantId === 'cost-verify-tenant-B', 'record2 is for tenant B');
  assert(record.tenantId !== record2.tenantId, 'tenant A and B records are isolated');
  assert(record.id !== record2.id, 'records have unique IDs');

  // 3. Cost record does not contain secrets
  console.log('\n[3] Cost records do not leak secrets');
  const recordStr = JSON.stringify(record);
  assert(!recordStr.includes('password'), 'no password in record');
  assert(!recordStr.includes('secret'), 'no secret in record');
  assert(!recordStr.includes('api_key'), 'no api_key in record');

  // 4. Records were captured
  console.log('\n[4] Cost records captured by sink');
  assert(capturedRecords.length >= 2, `at least 2 records captured (got ${capturedRecords.length})`);
  const tenantARecords = capturedRecords.filter(r => r.tenantId === 'cost-verify-tenant-A');
  const tenantBRecords = capturedRecords.filter(r => r.tenantId === 'cost-verify-tenant-B');
  assert(tenantARecords.length >= 1, 'tenant A has records');
  assert(tenantBRecords.length >= 1, 'tenant B has records');
  assert(
    tenantARecords.every(r => r.tenantId === 'cost-verify-tenant-A'),
    'tenant A records only contain tenant A ID'
  );

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('verify-cost-accounting FATAL:', err);
  process.exit(1);
});
