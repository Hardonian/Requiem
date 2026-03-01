#!/usr/bin/env tsx
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const CLI_PATH = path.join(process.cwd(), 'packages/cli/src/cli.ts');
const CSV_PATH = path.join(process.cwd(), 'decisions.csv');

async function main() {
  console.log('📥 Verifying Import command...');

  // 1. Ensure CSV exists
  if (!fs.existsSync(CSV_PATH)) {
    console.log('  Creating sample decisions.csv...');
    const csvContent = `tenant_id,source_type,source_ref,decision_input,decision_output,status,execution_latency,outcome_status
import-test,csv,row-1,"{""prompt"":""hello""}","{""response"":""world""}",evaluated,100,success
import-test,csv,row-2,"{""prompt"":""foo""}","{""response"":""bar""}",evaluated,200,success
import-test,csv,row-3,"{""prompt"":""error""}","{""error"":""fail""}",evaluated,50,failure
`;
    fs.writeFileSync(CSV_PATH, csvContent);
  }

  // 2. Run Import
  console.log(`  Running import on ${path.basename(CSV_PATH)}...`);
  const importResult = spawnSync('npx', ['tsx', CLI_PATH, 'import', CSV_PATH], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env }
  });

  if (importResult.status !== 0) {
    console.error('  ❌ Import failed:', importResult.stderr.toString());
    process.exit(1);
  }
  console.log('  ✓ Import successful');

  // 3. Verify Stats
  console.log('  Verifying stats...');
  const statsResult = spawnSync('npx', ['tsx', CLI_PATH, 'stats', '--tenant', 'import-test', '--json'], {
    encoding: 'utf-8',
    shell: true,
    env: { ...process.env }
  });

  if (statsResult.status !== 0) {
    console.error('  ❌ Stats command failed:', statsResult.stderr);
    process.exit(1);
  }

  try {
    const stats = JSON.parse(statsResult.stdout);
    if (stats.total_decisions >= 3) {
      console.log(`  ✓ Stats verified (${stats.total_decisions} records)`);
    } else {
      throw new Error(`Expected >= 3 records, got ${stats.total_decisions}`);
    }
  } catch (e) {
    console.error('  ❌ Stats verification failed:', (e as Error).message);
    process.exit(1);
  }

  console.log('✅ Import verification passed');
}

main();
