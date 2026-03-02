#!/usr/bin/env tsx
/**
 * verify:boundaries - API boundary verification per KERNEL_SPEC §3
 * 
 * Verifies:
 * - All API routes return typed envelopes (v1 schema)
 * - No secret leakage in responses
 * - No hard-500 errors
 * - Domain separation prefixes in hashes
 */

import { spawnSync } from 'child_process';

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

// Run CLI and parse JSON response
function runCli(args: string[]): any {
  const result = spawnSync('./build/requiem', args, {
    encoding: 'utf-8',
    cwd: '..',
    timeout: 10000
  });
  
  if (result.error) {
    throw new Error(`CLI execution failed: ${result.error.message}`);
  }
  
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Invalid JSON response: ${result.stdout.substring(0, 200)}`);
  }
}

console.log('═'.repeat(60));
console.log('API Boundary Verification (KERNEL_SPEC §3)');
console.log('═'.repeat(60));

// Test 1: Budget API envelope format
test('budget show returns v1 envelope', () => {
  const result = runCli(['budget', 'show', 'test-tenant']);
  assert(result.v === 1, `Expected v=1, got v=${result.v}`);
  assert(result.kind === 'budget.show', `Unexpected kind: ${result.kind}`);
  assert(result.data !== undefined, 'Missing data field');
  assert(result.error === null, 'Error should be null on success');
});

// Test 2: CAS API envelope format
test('cas put returns v1 envelope', () => {
  // Create a temp file to store
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const tmpFile = path.join(os.tmpdir(), 'test-content-' + Date.now());
  fs.writeFileSync(tmpFile, 'test content for boundary verification');
  
  const result = runCli(['cas', 'put', tmpFile]);
  fs.unlinkSync(tmpFile);
  
  assert(result.v === 1, `Expected v=1, got v=${result.v}`);
  assert(result.kind === 'cas.put', `Unexpected kind: ${result.kind}`);
  assert(result.data?.hash?.startsWith('cas:'), 'Hash should use cas: prefix');
});

// Test 3: Capability API envelope format
test('cap mint returns v1 envelope', () => {
  const result = runCli(['cap', 'mint', '--action=read', '--resource=/test']);
  assert(result.v === 1, `Expected v=1, got v=${result.v}`);
  assert(result.kind === 'cap.mint', `Unexpected kind: ${result.kind}`);
  assert(result.data?.capability !== undefined, 'Missing capability in data');
});

// Test 4: Policy API envelope format
test('policy list returns v1 envelope', () => {
  const result = runCli(['policy', 'list']);
  assert(result.v === 1, `Expected v=1, got v=${result.v}`);
  assert(result.kind === 'policy.list', `Unexpected kind: ${result.kind}`);
  assert(Array.isArray(result.data?.policies), 'Policies should be an array');
});

// Test 5: Event log API envelope format
test('log tail returns v1 envelope', () => {
  const result = runCli(['log', 'tail', '--limit=1']);
  assert(result.v === 1, `Expected v=1, got v=${result.v}`);
  assert(result.kind === 'log.tail', `Unexpected kind: ${result.kind}`);
  assert(Array.isArray(result.data?.events), 'Events should be an array');
});

// Test 6: Receipt API envelope format
test('receipt show returns v1 envelope', () => {
  const result = runCli(['receipt', 'show', '--all']);
  assert(result.v === 1, `Expected v=1, got v=${result.v}`);
  assert(result.kind === 'receipt.show', `Unexpected kind: ${result.kind}`);
});

// Test 7: Snapshot API envelope format
test('snapshot list returns v1 envelope', () => {
  const result = runCli(['snapshot', 'list']);
  assert(result.v === 1, `Expected v=1, got v=${result.v}`);
  assert(result.kind === 'snapshot.list', `Unexpected kind: ${result.kind}`);
  assert(Array.isArray(result.data?.snapshots), 'Snapshots should be an array');
});

// Test 8: Plan API envelope format
test('plan list returns v1 envelope', () => {
  const result = runCli(['plan', 'list']);
  assert(result.v === 1, `Expected v=1, got v=${result.v}`);
  assert(result.kind === 'plan.list', `Unexpected kind: ${result.kind}`);
  assert(Array.isArray(result.data?.plans), 'Plans should be an array');
});

// Test 9: No secret leakage
test('cap mint does not leak secret key', () => {
  const result = runCli(['cap', 'mint', '--action=read', '--resource=/secret-test']);
  const json = JSON.stringify(result);
  assert(!json.includes('sk-'), 'Response should not contain secret key');
  assert(!json.includes('private'), 'Response should not contain private key');
  assert(json.includes('cap:') || json.includes('fingerprint'), 'Should contain capability fingerprint');
});

// Test 10: Domain separation prefixes
test('hashes use domain separation prefixes', () => {
  const result = runCli(['cas', 'put', '--data=test-prefix-check']);
  if (result.data?.hash) {
    assert(
      result.data.hash.startsWith('cas:') || 
      result.data.hash.startsWith('cap:') ||
      result.data.hash.startsWith('evt:') ||
      result.data.hash.startsWith('rcpt:'),
      'Hash should use domain prefix'
    );
  }
});

// Test 11: Error envelope format
test('error responses use v1 envelope', () => {
  // Test with an invalid command that should return an error envelope
  const result = runCli(['cas', 'get', 'invalid-hash-format']);
  assert(result.v === 1, `Expected v=1 in error, got v=${result.v}`);
  assert(result.kind === 'error', `Expected kind=error, got ${result.kind}`);
  assert(result.error !== null, 'Error field should be populated');
  assert(result.error?.code !== undefined, 'Error should have a code');
  assert(result.error?.message !== undefined, 'Error should have a message');
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
  process.exit(1);
} else {
  console.log('');
  console.log('✓ All boundary verification tests passed');
  process.exit(0);
}
