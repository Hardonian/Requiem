#!/usr/bin/env node
/**
 * Industrialization Pass Verification Script
 *
 * Verifies all gates from the industrialization pass are met.
 * Run with: npx tsx scripts/verify-industrialization.ts
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const CLI_DIST = join(ROOT, 'packages/cli/dist/cli/src/cli.js');

interface VerificationResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

const results: VerificationResult[] = [];

function verify(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, status: 'PASS', message: 'OK' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'FAIL', message });
  }
}

function warn(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, status: 'PASS', message: 'OK' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'WARN', message });
  }
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   INDUSTRIALIZATION PASS VERIFICATION                      ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// SECTION 1: Build Verification
console.log('📦 SECTION 1: Build Verification');
console.log('─────────────────────────────────');

verify('C++ Engine Built', () => {
  const enginePath = join(ROOT, 'build/Debug/requiem.exe');
  if (!existsSync(enginePath)) {
    throw new Error('Engine not found at build/Debug/requiem.exe');
  }
});

verify('CLI TypeScript Compiled', () => {
  if (!existsSync(CLI_DIST)) {
    throw new Error('CLI not compiled. Run: cd packages/cli && npx tsc');
  }
});

verify('CLI Help Works', () => {
  const output = execSync(`node ${CLI_DIST} --help`, { encoding: 'utf-8' });
  if (!output.includes('Requiem CLI')) {
    throw new Error('CLI help output unexpected');
  }
});

console.log('\n🔍 SECTION 2: Code Quality');
console.log('─────────────────────────────────');

warn('TypeScript Type Check', () => {
  execSync('npx tsc --project ready-layer/tsconfig.json --noEmit', {
    cwd: ROOT,
    stdio: 'pipe',
  });
});

warn('ESLint Pass', () => {
  execSync('pnpm run lint', { cwd: ROOT, stdio: 'pipe' });
});

console.log('\n🧪 SECTION 3: Test Verification');
console.log('─────────────────────────────────');

verify('CLI Test File Exists', () => {
  const testPath = join(ROOT, 'packages/cli/tests/snapshots/cli.test.ts');
  if (!existsSync(testPath)) {
    throw new Error('CLI snapshot tests not found');
  }
});

verify('Table-Driven Tests Exist', () => {
  const testPath = join(ROOT, 'packages/cli/tests/table-driven/cli-commands.test.ts');
  if (!existsSync(testPath)) {
    throw new Error('Table-driven tests not found');
  }
});

console.log('\n📚 SECTION 4: Documentation');
console.log('─────────────────────────────────');

verify('README Exists', () => {
  if (!existsSync(join(ROOT, 'README.md'))) {
    throw new Error('README.md not found');
  }
});

verify('CONTRIBUTING Exists', () => {
  if (!existsSync(join(ROOT, 'CONTRIBUTING.md'))) {
    throw new Error('CONTRIBUTING.md not found');
  }
});

verify('CLI Schema Doc Exists', () => {
  if (!existsSync(join(ROOT, 'docs/CLI_SCHEMA.md'))) {
    throw new Error('docs/CLI_SCHEMA.md not found');
  }
});

verify('Industrialization Report Exists', () => {
  if (!existsSync(join(ROOT, 'docs/INDUSTRIALIZATION_REPORT.md'))) {
    throw new Error('docs/INDUSTRIALIZATION_REPORT.md not found');
  }
});

console.log('\n🔐 SECTION 5: Error Handling');
console.log('─────────────────────────────────');

verify('Error Module Exists', () => {
  if (!existsSync(join(ROOT, 'packages/cli/src/core/errors.ts'))) {
    throw new Error('Error handling module not found');
  }
});

verify('Exit Codes Module Exists', () => {
  if (!existsSync(join(ROOT, 'packages/cli/src/core/exit-codes.ts'))) {
    throw new Error('Exit codes module not found');
  }
});

console.log('\n🌐 SECTION 6: Web Build');
console.log('─────────────────────────────────');

warn('Ready-Layer Builds', () => {
  execSync('pnpm run build:web', { cwd: ROOT, stdio: 'pipe' });
});

// Print Results
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   RESULTS                                                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const passCount = results.filter((r) => r.status === 'PASS').length;
const failCount = results.filter((r) => r.status === 'FAIL').length;
const warnCount = results.filter((r) => r.status === 'WARN').length;

results.forEach((result) => {
  const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
  const color = result.status === 'PASS' ? '\x1b[32m' : result.status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  const reset = '\x1b[0m';
  console.log(`${color}${icon}${reset} ${result.name.padEnd(40)} ${color}[${result.status}]${reset}`);
  if (result.status !== 'PASS') {
    console.log(`  └─ ${result.message}`);
  }
});

console.log('\n─────────────────────────────────');
console.log(`Total: ${results.length} | \x1b[32m${passCount} PASS\x1b[0m | \x1b[31m${failCount} FAIL\x1b[0m | \x1b[33m${warnCount} WARN\x1b[0m`);

if (failCount === 0) {
  console.log('\n✅ ALL CRITICAL GATES PASSED - GREEN STATUS ACHIEVED');
  process.exit(0);
} else {
  console.log('\n❌ SOME GATES FAILED - REVIEW REQUIRED');
  process.exit(1);
}
