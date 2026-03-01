#!/usr/bin/env tsx
import { config } from './packages/cli/src/commands/config';
import { readConfig } from './packages/cli/src/lib/global-config';
import { randomUUID } from 'crypto';

async function main() {
  console.log('⚙️  Verifying Config command...');

  const testTenantId = `tenant_${randomUUID()}`;

  // 1. Set Config
  console.log(`  Setting defaultTenantId = ${testTenantId}`);
  // Mock process.argv for commander: node script set key value
  await config.parseAsync(['node', 'test', 'set', 'defaultTenantId', testTenantId]);

  // 2. Verify Persistence (Direct Read)
  const stored = readConfig();
  if (stored.defaultTenantId !== testTenantId) {
    throw new Error(`Config persistence failed. Expected ${testTenantId}, got ${stored.defaultTenantId}`);
  }
  console.log('  ✓ Value persisted to disk');

  console.log('✅ Config verification passed');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
