#!/usr/bin/env tsx
/**
 * verify-tenant-isolation.ts — Tenant isolation smoke test.
 *
 * Validates that:
 * 1. Tool registry is isolated per tenant (tenant A cannot see tenant B's tools)
 * 2. tenantScoped: true tools require a valid tenant ID
 * 3. tenantScoped: false tools (system tools) are accessible to all tenants
 * 4. Invoking a tenantScoped tool without a tenant is denied (POLICY_DENIED)
 *
 * Run: npx tsx scripts/verify-tenant-isolation.ts
 */

import { registerTool, getTool, listTools, SYSTEM_TENANT } from '../packages/ai/src/tools/registry.js';
import { invokeToolWithPolicy } from '../packages/ai/src/tools/invoke.js';
import { AiErrorCode } from '../packages/ai/src/errors/codes.js';
import { AiError } from '../packages/ai/src/errors/AiError.js';
import { TenantRole } from '../packages/ai/src/types/index.js';
import type { InvocationContext } from '../packages/ai/src/types/index.js';

// Bootstrap built-ins
import '../packages/ai/src/tools/builtins/system.echo.js';
import '../packages/ai/src/tools/builtins/system.health.js';

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

async function assertThrowsCode(
  fn: () => Promise<unknown>,
  expectedCode: AiErrorCode,
  label: string
): Promise<void> {
  try {
    await fn();
    console.error(`  ✗ ${label} — expected throw, got success`);
    failed++;
  } catch (err) {
    if (err instanceof AiError && err.code === expectedCode) {
      console.log(`  ✓ ${label} (${expectedCode})`);
      passed++;
    } else {
      const actual = err instanceof AiError ? err.code : String(err);
      console.error(`  ✗ ${label} — wrong error: ${actual}`);
      failed++;
    }
  }
}

function makeCtx(tenantId: string, role: TenantRole = TenantRole.ADMIN): InvocationContext {
  return {
    tenant: { tenantId, userId: `user-${tenantId}`, role, derivedAt: new Date().toISOString() },
    actorId: `user-${tenantId}`,
    traceId: `trace-${tenantId}`,
    environment: 'test',
    createdAt: new Date().toISOString(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== verify-tenant-isolation ===\n');

  const TENANT_A = 'isolation-tenant-a';
  const TENANT_B = 'isolation-tenant-b';

  // Register a tenant-A-specific tool
  registerTool(
    {
      name: 'isolation.private.tool',
      version: '1.0.0',
      description: 'Private tool for tenant A only',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
      deterministic: true,
      sideEffect: false,
      idempotent: true,
      requiredCapabilities: [],
      tenantScoped: true,
    },
    async () => ({ ok: true }),
    TENANT_A
  );

  // 1. Tool registered for tenant A is NOT visible to tenant B
  console.log('[1] Tenant A tool not visible to tenant B');
  const toolInA = getTool('isolation.private.tool', TENANT_A);
  const toolInB = getTool('isolation.private.tool', TENANT_B);
  assert(toolInA !== undefined, 'Tool found in tenant A registry');
  assert(toolInB === undefined, 'Tool NOT found in tenant B registry');

  // 2. System tools are accessible regardless of tenant
  console.log('\n[2] System tools accessible from any tenant');
  const echoInSystem = getTool('system.echo', SYSTEM_TENANT);
  assert(echoInSystem !== undefined, 'system.echo found in system registry');

  // 3. Tenant A can invoke its own tool
  console.log('\n[3] Tenant A can invoke its own private tool');
  try {
    const result = await invokeToolWithPolicy(makeCtx(TENANT_A), 'isolation.private.tool', {});
    assert(result.output !== undefined, 'Tenant A tool invoked successfully');
  } catch (err) {
    assert(false, `Tenant A tool invocation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Tenant B cannot invoke tenant A's tool (TOOL_NOT_FOUND from B's perspective)
  console.log('\n[4] Tenant B cannot invoke tenant A private tool');
  await assertThrowsCode(
    () => invokeToolWithPolicy(makeCtx(TENANT_B), 'isolation.private.tool', {}),
    AiErrorCode.TOOL_NOT_FOUND,
    'Tenant B denied access to tenant A tool'
  );

  // 5. tenantScoped tool without tenant → POLICY_DENIED (tool in system registry)
  // Note: tenant-specific tools (not in system registry) return TENANT_REQUIRED;
  // system-registered tenantScoped tools return POLICY_DENIED. Both enforce isolation.
  console.log('\n[5] tenantScoped tool in system registry without tenant → POLICY_DENIED');
  const noTenantCtx: InvocationContext = {
    tenant: { tenantId: '', userId: '', role: TenantRole.VIEWER, derivedAt: '' },
    actorId: 'anonymous',
    traceId: 'trace-no-tenant',
    environment: 'test',
    createdAt: new Date().toISOString(),
  };
  // Register a tenantScoped system tool for this check
  registerTool(
    {
      name: 'isolation.system.scoped',
      version: '1.0.0',
      description: 'System-registered tenantScoped tool for isolation test',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      deterministic: true,
      sideEffect: false,
      idempotent: true,
      requiredCapabilities: [],
      tenantScoped: true,
    },
    async () => ({})
    // No tenantId → registered in SYSTEM_TENANT registry
  );
  await assertThrowsCode(
    () => invokeToolWithPolicy(noTenantCtx, 'isolation.system.scoped', {}),
    AiErrorCode.POLICY_DENIED,
    'tenantScoped system tool denied without tenant'
  );

  // 6. system.echo (tenantScoped: false) works without tenant
  console.log('\n[6] system.echo (tenantScoped: false) works without tenant');
  try {
    const result = await invokeToolWithPolicy(noTenantCtx, 'system.echo', { payload: 'isolation-check' });
    assert(
      (result.output as Record<string, unknown>)?.payload === 'isolation-check',
      'system.echo works without tenant context'
    );
  } catch (err) {
    assert(false, `system.echo failed without tenant: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 7. listTools is scoped per tenant
  console.log('\n[7] listTools returns tenant-scoped + system tools');
  const toolsForA = listTools(TENANT_A);
  const toolsForB = listTools(TENANT_B);
  const privateToolInAList = toolsForA.some(t => t.name === 'isolation.private.tool');
  const privateToolInBList = toolsForB.some(t => t.name === 'isolation.private.tool');
  assert(privateToolInAList, 'Private tool appears in tenant A list');
  assert(!privateToolInBList, 'Private tool does NOT appear in tenant B list');

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
