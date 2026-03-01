/**
 * Chaos Engine — Quick determinism and replay verification
 *
 * INVARIANT: All checks are deterministic (no randomness)
 * INVARIANT: Fixed quick checks only (no long-running)
 * INVARIANT: No actual chaos - just verification
 */

import { hash } from '../hash';

export interface ChaosCheckResult {
  name: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ChaosReport {
  checks: ChaosCheckResult[];
  passed: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  determinismScore: number; // 0-100
  reportHash: string;
  generatedAt: string; // Display only
}

export interface ChaosContext {
  env: Record<string, string | undefined>;
  hasEngine: boolean;
  hasDatabase: boolean;
  lastReplayMatch?: number;
  policyBypassAttempted?: boolean;
}

/**
 * Run quick chaos checks (fixed, deterministic)
 */
export function runChaosQuick(context: ChaosContext): ChaosReport {
  const checks: ChaosCheckResult[] = [];

  // Check 1: Environment presence
  checks.push(checkEnvPresence(context));

  // Check 2: Engine availability
  checks.push(checkEngineAvailability(context));

  // Check 3: Database connectivity
  checks.push(checkDatabaseConnectivity(context));

  // Check 4: Determinism parity
  checks.push(checkDeterminismParity(context));

  // Check 5: Replay parity
  checks.push(checkReplayParity(context));

  // Check 6: Policy bypass attempt
  checks.push(checkPolicyBypass(context));

  // Calculate summary
  const passed = checks.filter(c => c.passed && c.severity !== 'warning').length;
  const failed = checks.filter(c => !c.passed && c.severity === 'error').length;
  const warnings = checks.filter(c => c.severity === 'warning').length;

  // Calculate determinism score
  const determinismScore = Math.round((passed / checks.length) * 100);

  const report: ChaosReport = {
    checks,
    passed: failed === 0,
    summary: {
      total: checks.length,
      passed,
      failed,
      warnings,
    },
    determinismScore,
    reportHash: '', // Set below
    generatedAt: new Date().toISOString(),
  };

  report.reportHash = computeChaosHash(report);

  return report;
}

function checkEnvPresence(context: ChaosContext): ChaosCheckResult {
  const required = ['REQUIEM_ENV', 'TENANT_ID'];
  const missing = required.filter(k => !context.env[k]);

  if (missing.length === 0) {
    return {
      name: 'Environment Presence',
      passed: true,
      message: 'Required environment variables present',
      severity: 'info',
    };
  }

  return {
    name: 'Environment Presence',
    passed: false,
    message: `Missing environment variables: ${missing.join(', ')}`,
    severity: 'warning',
  };
}

function checkEngineAvailability(context: ChaosContext): ChaosCheckResult {
  if (context.hasEngine) {
    return {
      name: 'Engine Availability',
      passed: true,
      message: 'Requiem engine is available',
      severity: 'info',
    };
  }

  return {
    name: 'Engine Availability',
    passed: false,
    message: 'Requiem engine is not available',
    severity: 'error',
  };
}

function checkDatabaseConnectivity(context: ChaosContext): ChaosCheckResult {
  if (context.hasDatabase) {
    return {
      name: 'Database Connectivity',
      passed: true,
      message: 'Database connection is healthy',
      severity: 'info',
    };
  }

  return {
    name: 'Database Connectivity',
    passed: false,
    message: 'Database connection failed',
    severity: 'error',
  };
}

function checkDeterminismParity(context: ChaosContext): ChaosCheckResult {
  // Fixed check: verify determinism is configured
  const determinismEnabled = context.env['DETERMINISM_MODE'] === 'strict';

  if (determinismEnabled) {
    return {
      name: 'Determinism Parity',
      passed: true,
      message: 'Strict determinism mode enabled',
      severity: 'info',
    };
  }

  return {
    name: 'Determinism Parity',
    passed: true, // Warning, not error
    message: 'Determinism mode not strict (may allow nondeterministic behavior)',
    severity: 'warning',
  };
}

function checkReplayParity(context: ChaosContext): ChaosCheckResult {
  if (context.lastReplayMatch === undefined) {
    return {
      name: 'Replay Parity',
      passed: true,
      message: 'No replay data available (run replay to verify)',
      severity: 'warning',
    };
  }

  if (context.lastReplayMatch >= 100) {
    return {
      name: 'Replay Parity',
      passed: true,
      message: `Last replay match: ${context.lastReplayMatch}%`,
      severity: 'info',
    };
  }

  return {
    name: 'Replay Parity',
    passed: false,
    message: `Last replay mismatch: ${context.lastReplayMatch}% (expected 100%)`,
    severity: 'error',
  };
}

function checkPolicyBypass(context: ChaosContext): ChaosCheckResult {
  if (context.policyBypassAttempted) {
    return {
      name: 'Policy Bypass',
      passed: false,
      message: 'Policy bypass was attempted and BLOCKED',
      severity: 'error',
    };
  }

  return {
    name: 'Policy Bypass',
    passed: true,
    message: 'No policy bypass attempts detected',
    severity: 'info',
  };
}

/**
 * Compute deterministic chaos report hash
 */
function computeChaosHash(report: Omit<ChaosReport, 'reportHash' | 'generatedAt'>): string {
  const stableObj = {
    total: report.summary.total,
    passed: report.summary.passed,
    failed: report.summary.failed,
    score: report.determinismScore,
  };

  const json = JSON.stringify(stableObj, Object.keys(stableObj).sort());
  return hash(json).substring(0, 32);
}

/**
 * Format chaos report as table
 */
export function formatChaosAsTable(report: ChaosReport): string {
  const lines: string[] = [
    '┌────────────────────────────────────────────────────────────┐',
    '│ CHAOS REPORT (Quick)                                       │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Status:  ${(report.passed ? '✅ PASSED' : '❌ FAILED').padEnd(46)}│`,
    `│  Score:   ${(report.determinismScore + '%').padEnd(46)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  Total:   ${report.summary.total.toString().padStart(5)}                            │`,
    `│  Passed:  ${report.summary.passed.toString().padStart(5)}                            │`,
    `│  Failed:  ${report.summary.failed.toString().padStart(5)}                            │`,
    `│  Warnings:${report.summary.warnings.toString().padStart(5)}                            │`,
    '├────────────────────────────────────────────────────────────┤',
    '│  CHECKS                                                    │',
  ];

  for (const check of report.checks) {
    const icon = check.passed ? '✅' : check.severity === 'warning' ? '⚠️' : '❌';
    lines.push(`│  ${icon} ${check.name.substring(0, 20).padEnd(20)} ${check.passed ? 'OK' : 'FAIL'}`.padEnd(61) + '│');
  }

  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push(`│  Hash: ${report.reportHash.substring(0, 16)}...`.padEnd(61) + '│');
  lines.push('└────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

/**
 * Format chaos report as JSON
 */
export function formatChaosAsJson(report: ChaosReport): Record<string, unknown> {
  return {
    passed: report.passed,
    score: report.determinismScore,
    summary: report.summary,
    checks: report.checks.map(c => ({
      name: c.name,
      passed: c.passed,
      severity: c.severity,
    })),
    reportHash: report.reportHash,
  };
}
