#!/usr/bin/env tsx
import { spawnSync } from 'child_process';
import path from 'path';

const CLI_SRC = path.join(process.cwd(), 'packages/cli/src');

function runScript(scriptName: string) {
  const scriptPath = path.join(CLI_SRC, scriptName);
  console.log(`\n⚡ Executing ${scriptName}...`);
  const result = spawnSync('npx', ['tsx', scriptPath], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  if (result.status !== 0) {
    console.error(`❌ ${scriptName} failed.`);
    process.exit(1);
  }
}

console.log('🔍 Starting System Verification Sequence');

// 1. Verify Initialization
runScript('verify-init.ts');

// 2. Verify Doctor Checks
runScript('run-doctor.ts');

// 3. Verify Telemetry Command (Smoke Test)
console.log('\n⚡ Executing requiem telemetry --json...');
const telResult = spawnSync('npx', ['tsx', path.join(CLI_SRC, 'cli.ts'), 'telemetry', '--json'], {
  encoding: 'utf-8',
  shell: true
});
if (telResult.status === 0) console.log('  ✓ Telemetry command runs successfully');
else console.error('  ❌ Telemetry command failed', telResult.stderr);

// 4. Verify Stress Command
console.log('\n⚡ Executing requiem stress (1s smoke test)...');
const stressResult = spawnSync('npx', ['tsx', path.join(CLI_SRC, 'cli.ts'), 'stress', '--duration', '1', '--rate', '2'], {
  encoding: 'utf-8',
  shell: true
});
if (stressResult.status === 0) console.log('  ✓ Stress command runs successfully');
else console.error('  ❌ Stress command failed', stressResult.stderr);

console.log('\n✅ Verification Sequence Complete');
