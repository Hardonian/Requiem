/**
 * Invariant Test Runner
 *
 * Entry point for all invariant tests.
 * Run with: npx tsx tests/invariants/index.ts
 */

import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  path.join(__dirname, 'run-lifecycle.test.ts'),
  path.join(__dirname, 'assertions.test.ts'),
  path.join(__dirname, 'branded-types.test.ts'),
];

console.log('Running invariant tests...\n');
console.log('Test files:');
for (const f of testFiles) {
  console.log(`  - ${path.relative(process.cwd(), f)}`);
}
console.log('');

const stream = run({ files: testFiles });
stream.compose(spec).pipe(process.stdout);

stream.on('test:fail', () => {
  process.exitCode = 1;
});
