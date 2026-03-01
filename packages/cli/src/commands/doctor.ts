import { getDB } from '../db/connection';
import { checkEngineAvailability } from '../engine/adapter';
import { DecisionRepository } from '../db/decisions';
import { readConfig } from '../global-config';

export async function runDoctor(options: { json: boolean }): Promise<number> {
  const checks: Array<{ name: string; status: 'ok' | 'fail'; message: string }> = [];

  // 1. Engine Check
  try {
    const engineCheck = await checkEngineAvailability();
    checks.push({
      name: 'Decision Engine',
      status: engineCheck.available ? 'ok' : 'fail',
      message: engineCheck.available
        ? `Available (${engineCheck.engineType})`
        : `Unavailable: ${engineCheck.error}`,
    });
  } catch (e) {
    checks.push({
      name: 'Decision Engine',
      status: 'fail',
      message: `Check failed: ${(e as Error).message}`,
    });
  }

  // 2. Database Connection
  try {
    const db = getDB();
    // Simple query to verify connection and table existence
    const result = db.prepare('SELECT count(*) as count FROM decisions').get();
    const count = (result as Record<string, any>)?.count ?? 0;

    checks.push({
      name: 'Database',
      status: 'ok',
      message: `Connected (Decisions: ${count})`,
    });
  } catch (e) {
    checks.push({
      name: 'Database',
      status: 'fail',
      message: `Connection failed: ${(e as Error).message}`,
    });
  }

  // 3. Schema Integrity
  try {
    const db = getDB();
    // Verify 'usage' column is recognized in the schema
    db.prepare('SELECT usage FROM decisions LIMIT 1').get();

    checks.push({
      name: 'Schema Integrity',
      status: 'ok',
      message: 'Verified (decisions.usage)',
    });
  } catch (e) {
    checks.push({
      name: 'Schema Integrity',
      status: 'fail',
      message: `Schema mismatch: ${(e as Error).message}`,
    });
  }

  // 4. Telemetry Aggregation
  try {
    const stats = DecisionRepository.getStats();
    checks.push({
      name: 'Telemetry',
      status: 'ok',
      message: `Aggregator functional (n=${stats.total_decisions})`,
    });
  } catch (e) {
    checks.push({
      name: 'Telemetry',
      status: 'fail',
      message: `Aggregation failed: ${(e as Error).message}`,
    });
  }

  // 5. Global Configuration
  try {
    const config = readConfig();
    const isConfigured = !!config.defaultTenantId;
    checks.push({
      name: 'Configuration',
      status: 'ok',
      message: isConfigured
        ? `Valid (Tenant: ${config.defaultTenantId})`
        : 'Valid (Unconfigured)',
    });
  } catch (e) {
    checks.push({
      name: 'Configuration',
      status: 'fail',
      message: `Config check failed: ${(e as Error).message}`,
    });
  }

  if (options.json) {
    console.log(JSON.stringify(checks, null, 2));
  } else {
    console.log('\n💊 REQUIEM DOCTOR\n');
    for (const check of checks) {
      const icon = check.status === 'ok' ? '✓' : '✗';
      console.log(`${icon} ${check.name.padEnd(20)} ${check.message}`);
    }
    console.log('');
  }

  return checks.some(c => c.status === 'fail') ? 1 : 0;
}
