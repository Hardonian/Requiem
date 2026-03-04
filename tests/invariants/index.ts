/**
 * Invariant Test Runner
 *
 * Entry point for all invariant tests.
 * Run with: npx tsx tests/invariants/index.ts
 */

import { spawn } from 'node:child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  path.join(__dirname, 'run-lifecycle.test.ts'),
  path.join(__dirname, 'assertions.test.ts'),
  path.join(__dirname, 'branded-types.test.ts'),
  path.join(__dirname, 'proof-dependency.test.ts'),
  path.join(__dirname, 'runtime-fingerprint.test.ts'),
];

console.log('Running invariant tests...\n');
console.log('Test files:');
for (const f of testFiles) {
  console.log(`  - ${path.relative(process.cwd(), f)}`);
}
console.log('');

const child = spawn(process.execPath, ['--test', '--import', 'tsx', ...testFiles], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

process.exit(result.status ?? 1);
