#!/usr/bin/env tsx
import { init } from './commands/init';
import { readConfig } from './lib/global-config';
import { randomUUID } from 'crypto';

async function main() {
  console.log('🚀 Verifying Init command...');

  const testTenant = `init_test_${randomUUID().substring(0, 6)}`;

  // 1. Run Init
  // Mock process.argv: node script --tenant <id> --force
  await init.parseAsync(['node', 'test', '--tenant', testTenant, '--force']);

  // 2. Verify Config Persistence
  const config = readConfig();
  if (config.defaultTenantId !== testTenant) {
    throw new Error(`Init failed. Expected tenant ${testTenant}, got ${config.defaultTenantId}`);
  }
  console.log('  ✓ Config initialized correctly');
  console.log('✅ Init verification passed');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
