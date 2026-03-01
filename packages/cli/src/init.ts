import { Command } from 'commander';
import { randomUUID } from 'crypto';
import { readConfig, writeConfig } from '../lib/global-config';
import { getDB } from '../db/connection';

export const init = new Command('init')
  .description('Initialize Requiem configuration and database')
  .option('--tenant <id>', 'Set specific tenant ID')
  .option('-f, --force', 'Overwrite existing configuration')
  .action((options: { tenant?: string; force?: boolean }) => {
    const existing = readConfig();
    if (existing.defaultTenantId && !options.force) {
      console.log('⚠️  Configuration already exists.');
      console.log(`   Tenant: ${existing.defaultTenantId}`);
      console.log('   Use --force to overwrite.');
      return;
    }

    const tenantId = options.tenant || `tenant_${randomUUID().substring(0, 8)}`;

    // 1. Write Config
    writeConfig({
      defaultTenantId: tenantId,
      engineMode: 'ts', // Default to TS engine
      ...existing, // Keep other keys if force used, but we are overwriting mostly
    });

    // 2. Initialize DB (ensure tables)
    const db = getDB();
    // Trigger table creation by accessing it
    const tableCount = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length;

    console.log('\n🚀 Requiem Initialized\n');
    console.log(`   Tenant ID:   ${tenantId}`);
    console.log(`   Config:      ~/.requiem/config.json`);
    console.log(`   Database:    Initialized (${tableCount} tables)`);
    console.log('\nRun "requiem doctor" to verify system health.');
  });
