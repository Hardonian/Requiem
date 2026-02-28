#!/usr/bin/env tsx
/**
 * verify-ai-safety.ts — AI policy gate red-team tests
 *
 * Tests:
 * 1. Tool with requiredCapabilities denied to VIEWER role
 * 2. tenantScoped tool denied without tenant context
 * 3. Invalid schema input raises TOOL_SCHEMA_VIOLATION (not 500)
 * 4. Policy deny does NOT leak handler internals
 *
 * Run: npx tsx scripts/verify-ai-safety.ts
 */

import { registerTool, _clearRegistry } from '../packages/ai/src/tools/registry.js';
import { invokeToolWithPolicy } from '../packages/ai/src/tools/invoke.js';
import { AiError } from '../packages/ai/src/errors/AiError.js';
import { AiErrorCode } from '../packages/ai/src/errors/codes.js';
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
      console.error(`  ✗ ${label} — wrong error: ${err instanceof AiError ? err.code : String(err)}`);
      failed++;
    }
  }
}

// ─── Test Contexts ────────────────────────────────────────────────────────────

const viewerCtx: InvocationContext = {
  tenant: {
    tenantId: 'safety-tenant',
    userId: 'viewer-user',
    role: TenantRole.VIEWER,
    derivedAt: new Date().toISOString(),
  },
  actorId: 'viewer-user',
  traceId: 'safety-trace-001',
  environment: 'test',
  createdAt: new Date().toISOString(),
};

const adminCtx: InvocationContext = {
  tenant: {
    tenantId: 'safety-tenant',
    userId: 'admin-user',
    role: TenantRole.ADMIN,
    derivedAt: new Date().toISOString(),
  },
  actorId: 'admin-user',
  traceId: 'safety-trace-002',
  environment: 'test',
  createdAt: new Date().toISOString(),
};

const noTenantCtx: InvocationContext = {
  tenant: { tenantId: '', userId: '', role: TenantRole.VIEWER, derivedAt: '' },
  actorId: 'unknown',
  traceId: 'safety-trace-003',
  environment: 'test',
  createdAt: new Date().toISOString(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== verify-ai-safety ===\n');

  // Register a side-effect tool that requires capability
  registerTool(
    {
      name: 'safety.test.write',
      version: '1.0.0',
      description: 'Test tool requiring write capability',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: { done: { type: 'boolean' } } },
      deterministic: false,
      sideEffect: true,
      idempotent: false,
      requiredCapabilities: ['tools:write'],
      tenantScoped: true,
    },
    async () => ({ done: true })
  );

  // 1. VIEWER cannot call side-effect tools
  console.log('[1] VIEWER role denied side-effect tool');
  await assertThrowsCode(
    () => invokeToolWithPolicy(viewerCtx, 'safety.test.write', {}),
    AiErrorCode.POLICY_DENIED,
    'VIEWER denied side-effect tool'
  );

  // 2. ADMIN can call side-effect tools
  console.log('\n[2] ADMIN role allowed side-effect tool');
  try {
    const result = await invokeToolWithPolicy(adminCtx, 'safety.test.write', {});
    assert(result.output !== undefined, 'ADMIN can invoke write tool');
  } catch (err) {
    assert(false, `ADMIN unexpectedly denied: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Missing tenant on tenantScoped tool
  console.log('\n[3] Missing tenant context denied');
  await assertThrowsCode(
    () => invokeToolWithPolicy(noTenantCtx, 'safety.test.write', {}),
    AiErrorCode.POLICY_DENIED,
    'Missing tenantId denied for tenantScoped tool'
  );

  // 4. Unknown tool → TOOL_NOT_FOUND
  console.log('\n[4] Unknown tool → TOOL_NOT_FOUND');
  await assertThrowsCode(
    () => invokeToolWithPolicy(adminCtx, 'nonexistent.tool', {}),
    AiErrorCode.TOOL_NOT_FOUND,
    'Unknown tool raises TOOL_NOT_FOUND'
  );

  // 5. Schema violation on system.echo with empty input
  console.log('\n[5] Schema violation on system.echo with empty input');
  await assertThrowsCode(
    () => invokeToolWithPolicy(adminCtx, 'system.echo', {}),
    AiErrorCode.TOOL_SCHEMA_VIOLATION,
    'Empty input raises TOOL_SCHEMA_VIOLATION'
  );

  // 6. Error does not include stack trace in safe JSON
  console.log('\n[6] AiError.toSafeJson() contains no stack trace');
  const err = new AiError({
    code: AiErrorCode.POLICY_DENIED,
    message: 'Test error',
    phase: 'test',
    cause: new Error('Internal cause with stack'),
  });
  const safeJson = err.toSafeJson();
  const safeStr = JSON.stringify(safeJson);
  assert(!safeStr.includes('at Object.'), 'No stack trace in safe JSON');
  assert(!safeStr.includes('Internal cause'), 'No cause message in safe JSON');
  assert(safeJson.code === AiErrorCode.POLICY_DENIED, 'Error code preserved');

  // 7. system.echo is accessible without tenant (tenantScoped: false)
  console.log('\n[7] system.echo accessible without tenant (tenantScoped: false)');
  try {
    const result = await invokeToolWithPolicy(noTenantCtx, 'system.echo', { payload: 'test' });
    assert((result.output as Record<string, unknown>)?.payload === 'test', 'system.echo works without tenant');
  } catch (err) {
    assert(false, `system.echo unexpectedly failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('verify-ai-safety FATAL:', err);
  process.exit(1);
});
