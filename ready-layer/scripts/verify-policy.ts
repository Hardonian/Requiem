#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * verify:policy - Policy engine verification per KERNEL_SPEC §7
 *
 * Verifies:
 * - Policy add → list roundtrip
 * - Policy evaluation endpoint returns deterministic structure
 * - Policy versioning
 * - Budget command contracts return typed structures
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
console.log('Policy Engine Verification (KERNEL_SPEC §7)');
console.log('═'.repeat(60));

let testPolicyId = '';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'requiem-verify-policy-'));
const policyFile = path.join(tempDir, 'policy.json');
const evalFile = path.join(tempDir, 'policy-eval-input.json');

fs.writeFileSync(
  policyFile,
  JSON.stringify(
    {
      name: 'verify-policy',
      rules: [{ effect: 'allow', action: 'read', resource: '/public/*' }]
    },
    null,
    2
  )
);

fs.writeFileSync(
  evalFile,
  JSON.stringify(
    {
      request_id: 'verify-policy-request',
      command: '/bin/echo',
      argv: ['ok'],
      env: { PYTHONHASHSEED: '0' },
      policy: {
        mode: 'strict',
        deterministic: true
      }
    },
    null,
    2
  )
);

// Policy CRUD Tests
console.log('\n[Policy Management]');

test('Policy add creates new policy', () => {
  const result = runCli(['policy', 'add', '--file', policyFile]);
  assertSuccess(result, 'Policy add should succeed');

  const data = dataOf(result.parsed);
  assert(data?.ok === true, 'Policy add should return ok=true');
  assert(/^[a-f0-9]{64}$/i.test(data?.policy_hash), 'Policy hash should be returned');
  testPolicyId = data.policy_hash;
});

test('Policy list includes created policy', () => {
  const result = runCli(['policy', 'list']);
  assertSuccess(result, 'Policy list should succeed');
  const data = dataOf(result.parsed);
  const policies = data?.policies || [];
  assert(Array.isArray(policies), 'Should return policies array');
  assert(policies.length > 0, 'Should have at least one policy');
});

test('Policy eval returns deterministic decision structure', () => {
  const result = runCli([
    'policy', 'eval',
    '--policy', testPolicyId || 'verify-policy',
    '--input', evalFile
  ]);
  assertSuccess(result, 'Policy eval should succeed');

  const data = dataOf(result.parsed);
  assert(typeof data?.ok === 'boolean', 'Policy eval should return ok boolean');
  assert(Array.isArray(data?.violations), 'Policy eval should return violations array');
});

test('Policy versions tracks changes', () => {
  const result = runCli(['policy', 'versions', '--policy', testPolicyId || 'verify-policy']);
  assertSuccess(result, 'Policy versions should succeed');

  const data = dataOf(result.parsed);
  assert(Array.isArray(data?.versions), 'Should return versions array');
});

// Budget Enforcement Tests
console.log('\n[Budget Enforcement]');

test('Budget set creates budget', () => {
  const result = runCli([
    'budget', 'set',
    '--tenant', 'test-tenant',
    '--unit', 'exec',
    '--limit', '1000'
  ]);
  assertSuccess(result, 'Budget set should succeed');

  const data = dataOf(result.parsed);
  assert(data?.ok === true, 'Budget set should return ok=true');
  assert(data?.tenant_id === 'test-tenant', 'Budget set should return tenant');
});

test('Budget show returns correct structure', () => {
  const result = runCli(['budget', 'show', '--tenant', 'test-tenant']);
  assertSuccess(result, 'Budget show should succeed');

  const data = dataOf(result.parsed);
  assert(data?.tenant_id === 'test-tenant', 'Should return correct tenant');
  assert(data?.budgets?.exec, 'Should include exec budget');
  assert(data?.budgets?.cas_put, 'Should include cas_put budget');
  assert(data?.budgets?.policy_eval, 'Should include policy_eval budget');
  assert(typeof data?.budget_hash === 'string', 'Should include budget hash');
});

test('Budget usage fields are present and numeric', () => {
  const result = runCli(['budget', 'show', '--tenant', 'test-tenant']);
  assertSuccess(result, 'Budget show should succeed');

  const data = dataOf(result.parsed);
  const execBudget = data?.budgets?.exec;
  assert(typeof execBudget?.limit === 'number', 'exec.limit should be numeric');
  assert(typeof execBudget?.used === 'number', 'exec.used should be numeric');
  assert(typeof execBudget?.remaining === 'number', 'exec.remaining should be numeric');
});

test('Budget window reset works', () => {
  const result = runCli(['budget', 'reset-window', '--tenant', 'test-tenant']);
  assertSuccess(result, 'Budget reset-window should succeed');

  const data = dataOf(result.parsed);
  assert(data?.ok === true, 'Reset should return ok=true');
});

// Policy Test Suite
console.log('\n[Policy Test Suite]');

test('Policy test validates rules', () => {
  const result = runCli(['policy', 'test']);
  assertSuccess(result, 'Policy test should succeed');

  const data = dataOf(result.parsed);
  assert(typeof data?.tests_run === 'number', 'Should return tests_run');
  assert(typeof data?.tests_passed === 'number', 'Should return tests_passed');
  console.log(`    (${data.tests_run} tests in suite)`);
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
  console.log('✓ All policy verification tests passed');
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exit(0);
}
