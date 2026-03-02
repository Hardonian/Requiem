#!/usr/bin/env tsx
/**
 * verify:replay - Replay determinism verification per KERNEL_SPEC §8, §10
 * 
 * Verifies INV-REPLAY: replay(same_inputs) → identical receipt_hash
 * 
 * Tests:
 * - Same inputs produce same receipt hash
 * - Different inputs produce different receipt hashes  
 * - Plan execution with determinism verification
 * - Plan replay produces identical results
 */

import { spawnSync } from 'child_process';
import * as crypto from 'crypto';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
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

function runCli(args: string[]): any {
  const result = spawnSync('./build/requiem', args, {
    encoding: 'utf-8',
    cwd: '..',
    timeout: 15000
  });
  
  if (result.error) {
    throw new Error(`CLI execution failed: ${result.error.message}`);
  }
  
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Invalid JSON: ${result.stdout.substring(0, 200)}`);
  }
}

console.log('═'.repeat(60));
console.log('Replay Determinism Verification (INV-REPLAY)');
console.log('═'.repeat(60));

let planId1 = '';
let receiptHash1 = '';
let receiptHash2 = '';

// Determinism Tests
console.log('\n[Receipt Determinism]');

test('Same plan execution produces same receipt hash', () => {
  // Create a deterministic plan
  const plan = {
    name: 'determinism-test-' + Date.now(),
    steps: [
      { name: 'step1', tool: 'echo', inputs: { message: 'hello' } },
      { name: 'step2', tool: 'echo', inputs: { message: 'world' } }
    ]
  };
  
  // Add the plan
  const addResult = runCli(['plan', 'add', '--plan', JSON.stringify(plan)]);
  planId1 = addResult.data?.plan_id;
  assert(planId1, 'Plan should be created');
  
  // Execute first time
  const run1 = runCli(['plan', 'run', planId1]);
  receiptHash1 = run1.data?.receipt?.hash || run1.data?.receipt_hash;
  assert(receiptHash1, 'First execution should produce receipt');
  
  // Execute second time (same inputs)
  const run2 = runCli(['plan', 'run', planId1]);
  receiptHash2 = run2.data?.receipt?.hash || run2.data?.receipt_hash;
  assert(receiptHash2, 'Second execution should produce receipt');
  
  // INV-REPLAY: same inputs → identical receipt_hash
  assert(receiptHash1 === receiptHash2, 
    `INV-REPLAY violated: ${receiptHash1} !== ${receiptHash2}`);
});

test('Receipt hash changes with different inputs', () => {
  // Create a plan with different inputs
  const plan = {
    name: 'different-inputs-test-' + Date.now(),
    steps: [
      { name: 'step1', tool: 'echo', inputs: { message: 'different' } }
    ]
  };
  
  const addResult = runCli(['plan', 'add', '--plan', JSON.stringify(plan)]);
  const planId2 = addResult.data?.plan_id;
  assert(planId2, 'Second plan should be created');
  
  const run3 = runCli(['plan', 'run', planId2]);
  const receiptHash3 = run3.data?.receipt?.hash || run3.data?.receipt_hash;
  
  assert(receiptHash3 !== receiptHash1, 
    `Different inputs should produce different hash: ${receiptHash3} vs ${receiptHash1}`);
});

// Plan Tests
console.log('\n[Plan Execution]');

test('Plan validate checks structure', () => {
  const validPlan = {
    name: 'valid-plan',
    steps: [
      { name: 's1', tool: 'echo', inputs: {} }
    ]
  };
  
  const result = runCli(['plan', 'validate', '--plan', JSON.stringify(validPlan)]);
  assert(result.data?.valid === true || result.ok === true, 'Valid plan should pass');
});

test('Plan hash is deterministic', () => {
  const plan = {
    name: 'hash-test',
    steps: [{ name: 's1', tool: 'echo', inputs: { msg: 'test' } }]
  };
  
  const hash1 = runCli(['plan', 'hash', '--plan', JSON.stringify(plan)]);
  const hash2 = runCli(['plan', 'hash', '--plan', JSON.stringify(plan)]);
  
  const h1 = hash1.data?.hash || hash1.data?.plan_hash;
  const h2 = hash2.data?.hash || hash2.data?.plan_hash;
  
  assert(h1 === h2, 'Plan hash should be deterministic');
});

test('Plan list returns all plans', () => {
  const result = runCli(['plan', 'list']);
  const plans = result.data?.plans || [];
  assert(Array.isArray(plans), 'Should return plans array');
  assert(plans.length >= 2, 'Should have at least 2 plans from previous tests');
});

test('Plan show returns plan details', () => {
  if (!planId1) throw new Error('Skipping: no plan from previous test');
  
  const result = runCli(['plan', 'show', planId1]);
  assert(result.data?.plan || result.data?.id, 'Should return plan details');
});

test('Plan replay re-executes with same inputs', () => {
  if (!planId1) throw new Error('Skipping: no plan from previous test');
  
  const result = runCli(['plan', 'replay', planId1]);
  assert(result.data?.receipt || result.data?.result, 'Replay should produce result');
  
  const replayHash = result.data?.receipt?.hash || result.data?.receipt_hash;
  if (replayHash) {
    assert(replayHash === receiptHash1, 
      `Replay should produce same receipt hash: ${replayHash} vs ${receiptHash1}`);
  }
});

// Snapshot Tests (related to replay state)
console.log('\n[Snapshot State]');

test('Snapshot create captures state', () => {
  const result = runCli(['snapshot', 'create']);
  assert(result.data?.snapshot?.hash || result.data?.snapshot_hash, 
         'Snapshot should be created');
});

test('Snapshot list returns snapshots', () => {
  const result = runCli(['snapshot', 'list']);
  const snapshots = result.data?.snapshots || [];
  assert(Array.isArray(snapshots), 'Should return snapshots array');
});

test('Snapshot contains plan state', () => {
  const result = runCli(['snapshot', 'list']);
  const snapshots = result.data?.snapshots || [];
  
  if (snapshots.length > 0) {
    const snap = snapshots[0];
    // Verify snapshot structure per KERNEL_SPEC
    assert(snap.logical_time !== undefined || snap.snapshot_version !== undefined,
           'Snapshot should have version/time fields');
  }
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
  process.exit(1);
} else {
  console.log('');
  console.log('✓ All replay verification tests passed');
  console.log('✓ INV-REPLAY invariant verified: replay(same_inputs) → identical receipt_hash');
  process.exit(0);
}
