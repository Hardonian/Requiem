#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * verify:replay - Replay determinism verification per KERNEL_SPEC §8, §10
 *
 * Verifies INV-REPLAY: replay(same_inputs) → identical receipt_hash
 *
 * Tests:
 * - Same deterministic plan inputs produce same receipt hash
 * - Different inputs produce different receipt hashes
 * - Plan verify/hash interfaces are deterministic
 * - Replay/snapshot/log command surfaces return typed structures
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
  parsed: any;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error });
    console.log(`  ✗ ${name}: ${error}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function parseStdout(stdout: string): any {
  const trimmed = stdout.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

function runCli(args: string[]): CliResult {
  const result = spawnSync('./build/requiem', args, {
    encoding: 'utf-8',
    cwd: '..',
    timeout: 15000
  });

  if (result.error) {
    throw new Error(`CLI execution failed: ${result.error.message}`);
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    parsed: parseStdout(result.stdout)
  };
}

function dataOf(parsed: any): any {
  if (parsed && typeof parsed === 'object' && parsed.v === 1 && 'kind' in parsed) {
    return parsed.data;
  }
  return parsed;
}

function isErrorEnvelope(parsed: any): boolean {
  return (
    !!parsed &&
    typeof parsed === 'object' &&
    parsed.v === 1 &&
    (parsed.kind === 'error' || parsed.error !== null)
  );
}

function assertSuccess(result: CliResult, message: string) {
  if (result.status !== 0) {
    throw new Error(`${message}: exit=${result.status} stderr=${result.stderr.trim()}`);
  }
  if (isErrorEnvelope(result.parsed)) {
    throw new Error(`${message}: ${JSON.stringify(result.parsed.error)}`);
  }
}

console.log('═'.repeat(60));
console.log('Replay Determinism Verification (INV-REPLAY)');
console.log('═'.repeat(60));

let receiptHash1 = '';
let receiptHash2 = '';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'requiem-verify-replay-'));
const planFile1 = path.join(tempDir, 'plan-1.json');
const planFile2 = path.join(tempDir, 'plan-2.json');

const plan1 = {
  plan_id: 'verify-replay-plan-1',
  plan_version: 1,
  steps: [
    {
      step_id: 's1',
      kind: 'exec',
      depends_on: [],
      config: {
        command: '/bin/echo',
        argv: ['hello'],
        workspace_root: '.',
        timeout_ms: 1000
      }
    }
  ]
};

const plan2 = {
  plan_id: 'verify-replay-plan-2',
  plan_version: 1,
  steps: [
    {
      step_id: 's1',
      kind: 'exec',
      depends_on: [],
      config: {
        command: '/bin/echo',
        argv: ['different'],
        workspace_root: '.',
        timeout_ms: 1000
      }
    }
  ]
};

fs.writeFileSync(planFile1, JSON.stringify(plan1, null, 2));
fs.writeFileSync(planFile2, JSON.stringify(plan2, null, 2));

// Determinism Tests
console.log('\n[Receipt Determinism]');

test('Same plan execution produces same receipt hash', () => {
  const run1 = runCli(['plan', 'run', '--plan', planFile1]);
  assertSuccess(run1, 'First plan run should succeed');
  receiptHash1 = dataOf(run1.parsed)?.receipt_hash;
  assert(!!receiptHash1, 'First execution should produce receipt');

  const run2 = runCli(['plan', 'run', '--plan', planFile1]);
  assertSuccess(run2, 'Second plan run should succeed');
  receiptHash2 = dataOf(run2.parsed)?.receipt_hash;
  assert(!!receiptHash2, 'Second execution should produce receipt');

  assert(receiptHash1 === receiptHash2, 
    `INV-REPLAY violated: ${receiptHash1} !== ${receiptHash2}`);
});

test('Receipt hash changes with different inputs', () => {
  const run3 = runCli(['plan', 'run', '--plan', planFile2]);
  assertSuccess(run3, 'Different-input plan run should succeed');
  const receiptHash3 = dataOf(run3.parsed)?.receipt_hash;
  assert(!!receiptHash3, 'Different-input run should produce receipt hash');

  assert(receiptHash3 !== receiptHash1, 
    `Different inputs should produce different hash: ${receiptHash3} vs ${receiptHash1}`);
});

// Plan Tests
console.log('\n[Plan Execution]');

test('Plan validate checks structure', () => {
  const result = runCli(['plan', 'verify', '--plan', planFile1]);
  assertSuccess(result, 'Plan verify should succeed');
  const data = dataOf(result.parsed);
  assert(data?.ok === true, 'Valid plan should pass');
});

test('Plan hash is deterministic', () => {
  const hash1 = runCli(['plan', 'hash', '--plan', planFile1]);
  const hash2 = runCli(['plan', 'hash', '--plan', planFile1]);
  assertSuccess(hash1, 'First plan hash should succeed');
  assertSuccess(hash2, 'Second plan hash should succeed');

  const h1 = dataOf(hash1.parsed)?.plan_hash;
  const h2 = dataOf(hash2.parsed)?.plan_hash;
  assert(h1 === h2, 'Plan hash should be deterministic');
});

test('Plan replay missing run-id returns typed error envelope', () => {
  const result = runCli(['plan', 'replay']);
  assert(result.status !== 0, 'plan replay without run-id should fail');
  assert(isErrorEnvelope(result.parsed), 'Failure should use typed error envelope');
});

// Snapshot Tests (related to replay state)
console.log('\n[Snapshot State]');

test('Snapshot create captures state', () => {
  const result = runCli(['snapshot', 'create']);
  assertSuccess(result, 'Snapshot create should succeed');
  const data = dataOf(result.parsed);
  assert(data?.snapshot?.snapshot_hash, 'Snapshot should include snapshot_hash');
});

test('Snapshot list returns snapshots', () => {
  const result = runCli(['snapshot', 'list']);
  assertSuccess(result, 'Snapshot list should succeed');
  const data = dataOf(result.parsed);
  const snapshots = data?.snapshots || [];
  assert(Array.isArray(snapshots), 'Should return snapshots array');
});

test('Log verify returns typed integrity summary', () => {
  const result = runCli(['log', 'verify']);
  assertSuccess(result, 'log verify should succeed');
  const data = dataOf(result.parsed);
  assert(typeof data?.ok === 'boolean', 'log verify should return ok boolean');
  assert(typeof data?.total_events === 'number', 'log verify should return total_events');
});

// Summary
console.log('');
console.log('─'.repeat(60));
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('');
  console.log('Failed tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  console.log('');
  console.log('⚠ INV-REPLAY may be violated - check determinism!');
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
} else {
  console.log('');
  console.log('✓ All replay verification tests passed');
  console.log('✓ INV-REPLAY invariant verified: replay(same_inputs) → identical receipt_hash');
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exit(0);
}
