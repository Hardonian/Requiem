#!/usr/bin/env tsx
import { spawnSync } from 'child_process';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'packages/cli/src/verify-dashboard.ts');
console.log(`\n⚡ Executing verify-dashboard.ts...`);
const result = spawnSync('npx', ['tsx', scriptPath], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

if (result.status !== 0) {
  console.error(`❌ Verification failed.`);
  process.exit(1);
}

