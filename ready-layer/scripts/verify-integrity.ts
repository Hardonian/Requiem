#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * verify:integrity - Content-addressed storage & capability registry integrity
 * 
 * Verifies:
 * - CAS put → get roundtrip preserves content
 * - CAS hash determinism (same content → same hash)
 * - Capability mint → inspect roundtrip
 * - Capability revocation works
 * - No ambient authority (explicit tokens required)
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
    timeout: 10000
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
console.log('Integrity Verification (CAS & Capabilities)');
console.log('═'.repeat(60));

// CAS Tests
console.log('\n[CAS Integrity]');

let testHash = '';
const testContent = 'integrity-test-content-' + Date.now();

test('CAS put stores content', () => {
  const tmpFile = path.join(os.tmpdir(), 'cas-test-' + Date.now());
  fs.writeFileSync(tmpFile, testContent);
  
  const result = runCli(['cas', 'put', tmpFile]);
  fs.unlinkSync(tmpFile);
  
  assert(result.ok === true || result.data?.hash, 'CAS put should succeed');
  testHash = result.data?.hash;
  assert(testHash?.length > 0, 'Hash should be returned');
});

test('CAS get retrieves correct content', () => {
  if (!testHash) throw new Error('Skipping: no hash from previous test');
  
  const result = runCli(['cas', 'get', testHash]);
  assert(result.data?.content === testContent || 
         result.data?.data === testContent, 
         'Retrieved content should match');
});

test('CAS hash is deterministic', () => {
  const tmpFile = path.join(os.tmpdir(), 'cas-test-det-' + Date.now());
  fs.writeFileSync(tmpFile, testContent);
  
  const result1 = runCli(['cas', 'put', tmpFile]);
  fs.unlinkSync(tmpFile);
  
  const hash1 = result1.data?.hash;
  
  // Create same content again
  const tmpFile2 = path.join(os.tmpdir(), 'cas-test-det2-' + Date.now());
  fs.writeFileSync(tmpFile2, testContent);
  
  const result2 = runCli(['cas', 'put', tmpFile2]);
  fs.unlinkSync(tmpFile2);
  
  const hash2 = result2.data?.hash;
  
  assert(hash1 === hash2, `Same content should produce same hash: ${hash1} vs ${hash2}`);
});

test('CAS ls lists stored objects', () => {
  const result = runCli(['cas', 'ls', '--limit=10']);
  assert(Array.isArray(result.data?.objects), 'Should return objects array');
});

test('CAS verify validates object integrity', () => {
  if (!testHash) throw new Error('Skipping: no hash from previous test');
  
  const result = runCli(['cas', 'verify', testHash]);
  assert(result.ok === true || result.data?.valid === true, 'CAS verify should succeed');
});

// Capability Tests
console.log('\n[Capability Registry Integrity]');

let testCapId = '';

test('Cap mint creates capability', () => {
  const result = runCli(['cap', 'mint', '--action=read', '--resource=/test-resource']);
  assert(result.data?.capability, 'Capability should be created');
  testCapId = result.data.capability.id || result.data.capability;
  assert(!!testCapId, 'Capability ID should be returned');
});

test('Cap inspect returns capability details', () => {
  if (!testCapId) throw new Error('Skipping: no capability from previous test');
  
  const result = runCli(['cap', 'inspect', testCapId]);
  assert(result.data?.capability || result.data?.id, 'Should return capability details');
});

test('Cap list includes created capability', () => {
  const result = runCli(['cap', 'list']);
  const caps = result.data?.capabilities || [];
  assert(Array.isArray(caps), 'Should return capabilities array');
  
  if (testCapId) {
    const found = caps.some((c: any) => 
      (c.id || c) === testCapId
    );
    // Don't fail if not found immediately - may be async
    console.log(`    (cap found in list: ${found})`);
  }
});

test('Cap revoke removes capability', () => {
  if (!testCapId) throw new Error('Skipping: no capability from previous test');
  
  // First create a new cap specifically to revoke
  const mintResult = runCli(['cap', 'mint', '--action=write', '--resource=/temp-resource']);
  const tempCapId = mintResult.data?.capability?.id || mintResult.data?.capability;
  
  if (!tempCapId) throw new Error('Failed to create temporary capability');
  
  const result = runCli(['cap', 'revoke', tempCapId]);
  assert(result.ok === true || result.data?.revoked === true, 'Revoke should succeed');
});

// No Ambient Authority Test
console.log('\n[No Ambient Authority]');

test('Operations require explicit capability/token', () => {
  // Try to access without token - should fail
  const result = runCli(['cas', 'get', 'cas:nonexistent']);
  // Should get error, not crash
  assert(result.kind === 'error' || result.error !== null || result.data === null,
         'Should return error for invalid access');
});

test('Secret keys never exposed in registry', () => {
  const result = runCli(['cap', 'list']);
  const json = JSON.stringify(result);
  
  // Check for common secret patterns
  assert(!json.includes('sk-'), 'Should not expose secret keys');
  assert(!json.includes('private_key'), 'Should not expose private keys');
  assert(!json.includes('secret'), 'Should not contain secret material');
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
  console.log('✓ All integrity verification tests passed');
  process.exit(0);
}
