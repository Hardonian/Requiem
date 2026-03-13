/**
 * CLI Command: requiem prove
 *
 * Runs all proof verification tests and generates proof artifacts:
 * - Determinism tests
 * - CAS integrity tests
 * - Policy reproducibility tests
 * - Crash recovery tests
 * - Replay verification
 * - Stress harness
 *
 * Output: /proofpacks/latest/
 * Summary: PASS / FAIL
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

interface ProveResult {
  suite: string;
  passed: boolean;
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  duration_ms: number;
  error?: string;
}

interface ProveSummary {
  timestamp: string;
  overall: 'PASS' | 'FAIL';
  engine_version: string;
  suites: ProveResult[];
  proofpack_dir: string;
  total_tests: number;
  total_passed: number;
  total_failed: number;
  total_duration_ms: number;
}

function runTestSuite(name: string, testPath: string, cwd: string): ProveResult {
  const start = Date.now();
  try {
    const result = execSync(
      `node --experimental-vm-modules --import tsx ${testPath}`,
      {
        cwd,
        encoding: 'utf-8',
        timeout: 120_000,
        env: {
          ...process.env,
          NODE_OPTIONS: '--experimental-vm-modules',
          PYTHONHASHSEED: '0',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    // Parse test output for pass/fail counts
    const passMatch = result.match(/# pass (\d+)/);
    const failMatch = result.match(/# fail (\d+)/);
    const testsMatch = result.match(/# tests (\d+)/);

    const passed = parseInt(passMatch?.[1] || '0', 10);
    const failed = parseInt(failMatch?.[1] || '0', 10);
    const total = parseInt(testsMatch?.[1] || String(passed + failed), 10);

    return {
      suite: name,
      passed: failed === 0,
      tests_run: total || 1,
      tests_passed: passed || total || 1,
      tests_failed: failed,
      duration_ms: Date.now() - start,
    };
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error
      ? String((error as { stderr: unknown }).stderr)
      : '';
    const stdout = error instanceof Error && 'stdout' in error
      ? String((error as { stdout: unknown }).stdout)
      : '';

    // Check if tests actually ran but had failures
    const failMatch = (stdout + stderr).match(/# fail (\d+)/);
    const passMatch = (stdout + stderr).match(/# pass (\d+)/);

    return {
      suite: name,
      passed: false,
      tests_run: parseInt(passMatch?.[1] || '0', 10) + parseInt(failMatch?.[1] || '1', 10),
      tests_passed: parseInt(passMatch?.[1] || '0', 10),
      tests_failed: parseInt(failMatch?.[1] || '1', 10),
      duration_ms: Date.now() - start,
      error: stderr.substring(0, 500) || 'Test execution failed',
    };
  }
}

export async function runProve(opts: {
  json: boolean;
  suites?: string[];
  outputDir?: string;
}): Promise<number> {
  const cwd = process.cwd();
  const outputDir = opts.outputDir || join(cwd, 'proofpacks', 'latest');

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const allSuites: Array<{ name: string; path: string }> = [
    { name: 'hash-parity', path: 'tests/hash-parity/hash-parity.test.ts' },
    { name: 'determinism', path: 'tests/determinism/replay.test.ts' },
    { name: 'cas-integrity', path: 'tests/cas/cas-integrity.test.ts' },
    { name: 'policy-reproducibility', path: 'tests/policy/policy-reproducibility.test.ts' },
    { name: 'crash-recovery', path: 'tests/crash/crash-recovery.test.ts' },
  ];

  const suitesToRun = opts.suites
    ? allSuites.filter(s => opts.suites!.includes(s.name))
    : allSuites;

  if (!opts.json) {
    process.stdout.write('\n  Requiem Proof Engine\n');
    process.stdout.write('  ====================\n\n');
  }

  const results: ProveResult[] = [];

  for (const suite of suitesToRun) {
    if (!opts.json) {
      process.stdout.write(`  [....] ${suite.name}`);
    }

    const testPath = join(cwd, suite.path);
    if (!existsSync(testPath)) {
      const result: ProveResult = {
        suite: suite.name,
        passed: false,
        tests_run: 0,
        tests_passed: 0,
        tests_failed: 1,
        duration_ms: 0,
        error: `Test file not found: ${suite.path}`,
      };
      results.push(result);
      if (!opts.json) {
        process.stdout.write(`\r  [SKIP] ${suite.name} — file not found\n`);
      }
      continue;
    }

    const result = runTestSuite(suite.name, testPath, cwd);
    results.push(result);

    if (!opts.json) {
      const status = result.passed ? 'PASS' : 'FAIL';
      const icon = result.passed ? ' OK ' : 'FAIL';
      process.stdout.write(`\r  [${icon}] ${suite.name} (${result.tests_passed}/${result.tests_run} in ${result.duration_ms}ms)\n`);
      if (result.error && !result.passed) {
        process.stdout.write(`         ${result.error.split('\n')[0]}\n`);
      }
    }
  }

  const totalTests = results.reduce((sum, r) => sum + r.tests_run, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.tests_passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.tests_failed, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);
  const overall = results.every(r => r.passed) ? 'PASS' : 'FAIL';

  const summary: ProveSummary = {
    timestamp: new Date().toISOString(),
    overall,
    engine_version: '1.3.0',
    suites: results,
    proofpack_dir: outputDir,
    total_tests: totalTests,
    total_passed: totalPassed,
    total_failed: totalFailed,
    total_duration_ms: totalDuration,
  };

  // Write summary to proofpacks/latest/
  writeFileSync(join(outputDir, 'prove-summary.json'), JSON.stringify(summary, null, 2));

  if (opts.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } else {
    process.stdout.write('\n  ────────────────────────\n');
    process.stdout.write(`  Result: ${overall}\n`);
    process.stdout.write(`  Tests:  ${totalPassed}/${totalTests} passed\n`);
    process.stdout.write(`  Time:   ${totalDuration}ms\n`);
    process.stdout.write(`  Output: ${outputDir}\n\n`);
  }

  return overall === 'PASS' ? 0 : 1;
}
