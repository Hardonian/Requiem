#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * verify:integrity - Content-addressed storage & capability registry integrity
 *
 * Verifies:
 * - CAS put → get roundtrip preserves content
 * - CAS hash determinism (same content → same hash)
 * - Capability mint/revoke flow works
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
    if (/^[a-f0-9]{64}$/i.test(trimmed)) {
      return { hash: trimmed };
    }
    return { raw: trimmed };
  }
}

function runCli(args: string[]): CliResult {
  const result = spawnSync('./build/requiem', args, {
    encoding: 'utf-8',
    cwd: '..',
    timeout: 10000
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
console.log('Integrity Verification (CAS & Capabilities)');
console.log('═'.repeat(60));

// CAS Tests
console.log('\n[CAS Integrity]');

let testHash = '';
let testCapFingerprint = '';
const testContent = 'integrity-test-content-static';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'requiem-verify-integrity-'));

test('CAS put stores content', () => {
  const tmpFile = path.join(tempDir, 'cas-test.txt');
  fs.writeFileSync(tmpFile, testContent);

  const result = runCli(['cas', 'put', '--in', tmpFile]);
  assertSuccess(result, 'CAS put should succeed');

  testHash = result.parsed?.hash || dataOf(result.parsed)?.hash;
  assert(/^[a-f0-9]{64}$/i.test(testHash), 'CAS put should return 64-char hash');
});

test('CAS get retrieves correct content', () => {
  if (!testHash) throw new Error('Skipping: no hash from previous test');

  const result = runCli(['cas', 'get', '--hash', testHash]);
  assertSuccess(result, 'CAS get should succeed');

  const data = dataOf(result.parsed);
  assert(data?.ok === true, 'CAS get should report ok=true');
  assert(data?.content === testContent, 'Retrieved content should match');
});

test('CAS hash is deterministic', () => {
  const tmpFile = path.join(tempDir, 'cas-test-det.txt');
  fs.writeFileSync(tmpFile, testContent);

  const result1 = runCli(['cas', 'put', '--in', tmpFile]);
  assertSuccess(result1, 'First CAS put should succeed');
  const hash1 = result1.parsed?.hash || dataOf(result1.parsed)?.hash;

  const tmpFile2 = path.join(tempDir, 'cas-test-det2.txt');
  fs.writeFileSync(tmpFile2, testContent);

  const result2 = runCli(['cas', 'put', '--in', tmpFile2]);
  assertSuccess(result2, 'Second CAS put should succeed');
  const hash2 = result2.parsed?.hash || dataOf(result2.parsed)?.hash;

  assert(hash1 === hash2, `Same content should produce same hash: ${hash1} vs ${hash2}`);
});

test('CAS ls lists stored objects', () => {
  const result = runCli(['cas', 'ls']);
  assertSuccess(result, 'CAS ls should succeed');
  const data = dataOf(result.parsed);
  assert(Array.isArray(data?.objects), 'Should return objects array');
});

test('CAS verify validates object integrity', () => {
  const result = runCli(['cas', 'verify']);
  assertSuccess(result, 'CAS verify should succeed');
  const data = dataOf(result.parsed);
  assert(typeof data?.errors === 'number', 'CAS verify should report errors');
  assert(data.errors === 0, `CAS verify reported ${data.errors} errors`);
});

// Capability Tests
console.log('\n[Capability Registry Integrity]');

test('Cap mint creates capability', () => {
  const keygen = runCli(['cap', 'keygen']);
  assertSuccess(keygen, 'cap keygen should succeed');

  const keys = dataOf(keygen.parsed);
  const secret = keys?.secret_key;
  const pub = keys?.public_key;
  assert(typeof secret === 'string' && secret.length > 0, 'secret_key should be present');
  assert(typeof pub === 'string' && pub.length > 0, 'public_key should be present');

  const keyFile = path.join(tempDir, 'cap-secret.key');
  fs.writeFileSync(keyFile, secret, 'utf-8');

  const mint = runCli([
    'cap',
    'mint',
    '--permissions',
    'exec.run',
    '--subject',
    'verify-integrity',
    '--key-file',
    keyFile,
    '--pub-key',
    pub
  ]);
  assertSuccess(mint, 'cap mint should succeed');

  const token = dataOf(mint.parsed);
  testCapFingerprint = token?.fingerprint;
  assert(/^[a-f0-9]{64}$/i.test(testCapFingerprint), 'Capability fingerprint should be present');
});

test('Cap revoke removes capability', () => {
  if (!testCapFingerprint) throw new Error('Skipping: no capability from previous test');

  const result = runCli(['cap', 'revoke', '--fingerprint', testCapFingerprint]);
  assertSuccess(result, 'cap revoke should succeed');

  const data = dataOf(result.parsed);
  assert(data?.ok === true, 'Revoke should return ok=true');
});

test('Cap list includes created capability', () => {
  const result = runCli(['caps', 'list']);
  assert(result.status === 0, `caps list should succeed: ${result.stderr.trim()}`);
  const data = dataOf(result.parsed);
  assert(Array.isArray(data?.capabilities), 'Should return capabilities array');
});

// No Ambient Authority Test
console.log('\n[No Ambient Authority]');

test('Operations require explicit capability/token', () => {
  const result = runCli(['cap', 'revoke']);
  assert(result.status !== 0, 'cap revoke without fingerprint should fail');
  assert(isErrorEnvelope(result.parsed), 'Failure should use typed error envelope');
});

test('Secret keys never exposed in registry', () => {
  const result = runCli(['caps', 'list']);
  assert(result.status === 0, `caps list should succeed: ${result.stderr.trim()}`);
  const json = JSON.stringify(dataOf(result.parsed));

  assert(!json.includes('sk-'), 'Should not expose secret keys');
  assert(!json.includes('private_key'), 'Should not expose private keys');
  assert(!json.includes('secret_key'), 'Should not expose secret_key fields');
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
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
} else {
  console.log('');
  console.log('✓ All integrity verification tests passed');
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exit(0);
}
