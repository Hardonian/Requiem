#!/usr/bin/env tsx
/**
 * verify-mcp.ts — MCP layer smoke test
 *
 * Tests:
 * 1. handleHealth() returns ok status
 * 2. handleListTools() returns at least system.echo + system.health
 * 3. handleCallTool('system.echo') returns correct output
 * 4. handleCallTool with unknown tool returns AI_TOOL_NOT_FOUND (not 500)
 *
 * Run: npx tsx scripts/verify-mcp.ts
 */

import {
  handleHealth,
  handleListTools,
  handleCallTool,
} from '../packages/ai/src/mcp/server.js';
import { AiErrorCode } from '../packages/ai/src/errors/codes.js';
import { TenantRole } from '../packages/ai/src/types/index.js';
import type { InvocationContext } from '../packages/ai/src/types/index.js';

// Bootstrap built-ins
import '../packages/ai/src/tools/builtins/system.echo.js';
import '../packages/ai/src/tools/builtins/system.health.js';

// ─── Test Context ─────────────────────────────────────────────────────────────

const testCtx: InvocationContext = {
  tenant: {
    tenantId: 'verify-tenant',
    userId: 'verify-user',
    role: TenantRole.ADMIN,
    derivedAt: new Date().toISOString(),
  },
  actorId: 'verify-user',
  traceId: 'verify-trace-001',
  environment: 'test',
  createdAt: new Date().toISOString(),
};

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
  console.log('\n=== verify-mcp ===\n');

  // 1. Health check
  console.log('[1] handleHealth()');
  const health = await handleHealth();
  assert(health.ok === true, 'health.ok is true');
  assert(health.data?.status === 'ok', 'health.data.status is ok');
  assert(typeof health.data?.tool_count === 'number', 'health.data.tool_count is number');
  assert(health.data!.tool_count >= 2, 'at least 2 tools registered');

  // 2. List tools
  console.log('\n[2] handleListTools()');
  const listed = await handleListTools(testCtx);
  assert(listed.ok === true, 'listTools.ok is true');
  const tools = listed.data?.tools ?? [];
  assert(tools.length >= 2, `at least 2 tools (got ${tools.length})`);
  const echoTool = tools.find(t => t.name === 'system.echo');
  assert(Boolean(echoTool), 'system.echo in tool list');
  const healthTool = tools.find(t => t.name === 'system.health');
  assert(Boolean(healthTool), 'system.health in tool list');

  // 3. Call system.echo
  console.log('\n[3] handleCallTool(system.echo)');
  const echoResult = await handleCallTool(testCtx, 'system.echo', { payload: 'hello-mcp' });
  assert(echoResult.ok === true, 'echo result ok');
  const echoContent = echoResult.data?.content as Record<string, unknown> | undefined;
  assert(echoContent?.payload === 'hello-mcp', 'echo returns correct payload');
  assert(typeof echoResult.data?.latencyMs === 'number', 'echo returns latencyMs');

  // 4. Call system.health
  console.log('\n[4] handleCallTool(system.health)');
  const healthResult = await handleCallTool(testCtx, 'system.health', {});
  assert(healthResult.ok === true, 'system.health call ok');
  const hContent = healthResult.data?.content as Record<string, unknown> | undefined;
  assert(hContent?.status === 'ok', 'system.health returns status:ok');

  // 5. Unknown tool returns TOOL_NOT_FOUND (not 500)
  console.log('\n[5] handleCallTool(unknown.tool) → TOOL_NOT_FOUND');
  const notFound = await handleCallTool(testCtx, 'nonexistent.tool', {});
  assert(notFound.ok === false, 'unknown tool returns ok:false');
  assert(notFound.error?.code === AiErrorCode.TOOL_NOT_FOUND, `error code is AI_TOOL_NOT_FOUND (got: ${notFound.error?.code})`);

  // 6. Schema validation error on bad input
  console.log('\n[6] handleCallTool(system.echo) with missing required field → TOOL_SCHEMA_VIOLATION');
  const badInput = await handleCallTool(testCtx, 'system.echo', {});
  assert(badInput.ok === false, 'bad input returns ok:false');
  assert(badInput.error?.code === AiErrorCode.TOOL_SCHEMA_VIOLATION, `error code is AI_TOOL_SCHEMA_VIOLATION (got: ${badInput.error?.code})`);

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('verify-mcp FATAL:', err);
  process.exit(1);
});
