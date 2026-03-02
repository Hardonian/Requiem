/**
 * Drift Engine — Detect changes over time in run behavior
 *
 * INVARIANT: Deterministic scoring based on fingerprint comparison
 * INVARIANT: No time-based nondeterminism in scoring algorithm
 */

import { hash } from '../hash.js';

export interface DriftEvent {
  runId: string;
  inputFingerprint: string;
  outputFingerprint: string | null;
  executionFingerprint: string | null;
  timestamp: string;
}

export interface DriftComparison {
  baselineRunId: string;
  comparedRunId: string;
  inputDrift: number; // 0-100, 0 = identical
  outputDrift: number;
  executionDrift: number;
  overallScore: number;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  firstDivergenceStep: number | null;
}

export interface DriftResult {
  baselineRunId: string;
  windowSize: number;
  comparisons: DriftComparison[];
  firstDivergence: DriftComparison | null;
  averageDrift: number;
  maxDrift: number;
  trend: 'stable' | 'increasing' | 'decreasing' | 'erratic';
  resultHash: string;
  analyzedAt: string; // Display only
}

/**
 * Analyze drift from baseline across a window of runs
 */
export function analyzeDrift(
  baseline: DriftEvent,
  window: DriftEvent[],
  options: { maxWindow?: number } = {}
): DriftResult {
  const { maxWindow = 100 } = options;

  // Limit window size for determinism
  const limitedWindow = window.slice(0, maxWindow);

  const comparisons: DriftComparison[] = [];

  for (const event of limitedWindow) {
    const comparison = compareEvents(baseline, event);
    comparisons.push(comparison);
  }

  // Sort by overall score for stable ordering
  comparisons.sort((a, b) => a.overallScore - b.overallScore);

  // Find first divergence
  const firstDivergence = comparisons.find(c => c.overallScore > 0) || null;

  // Calculate statistics
  const scores = comparisons.map(c => c.overallScore);
  const averageDrift = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;
  const maxDrift = scores.length > 0 ? Math.max(...scores) : 0;

  // Determine trend
  const trend = calculateTrend(scores);

  const result: DriftResult = {
    baselineRunId: baseline.runId,
    windowSize: limitedWindow.length,
    comparisons,
    firstDivergence,
    averageDrift,
    maxDrift,
    trend,
    resultHash: '', // Set below
    analyzedAt: new Date().toISOString(),
  };

  result.resultHash = computeDriftHash(result);

  return result;
}

/**
 * Compare two drift events
 */
function compareEvents(baseline: DriftEvent, compared: DriftEvent): DriftComparison {
  // Input drift: 0 if identical, 100 if completely different
  const inputDrift = baseline.inputFingerprint === compared.inputFingerprint ? 0 : 100;

  // Output drift
  let outputDrift = 0;
  if (baseline.outputFingerprint !== compared.outputFingerprint) {
    outputDrift = baseline.outputFingerprint === null || compared.outputFingerprint === null
      ? 50 // One has output, other doesn't
      : 100; // Both have different outputs
  }

  // Execution drift
  let executionDrift = 0;
  if (baseline.executionFingerprint !== compared.executionFingerprint) {
    executionDrift = baseline.executionFingerprint === null || compared.executionFingerprint === null
      ? 50
      : 100;
  }

  // Overall score (weighted average)
  const overallScore = Math.round(
    inputDrift * 0.4 + outputDrift * 0.4 + executionDrift * 0.2
  );

  // Severity classification
  const severity = classifySeverity(overallScore);

  return {
    baselineRunId: baseline.runId,
    comparedRunId: compared.runId,
    inputDrift,
    outputDrift,
    executionDrift,
    overallScore,
    severity,
    firstDivergenceStep: null, // Would be set by trace comparison
  };
}

/**
 * Classify drift severity
 */
function classifySeverity(score: number): DriftComparison['severity'] {
  if (score === 0) return 'none';
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

/**
 * Calculate trend from scores
 */
function calculateTrend(scores: number[]): DriftResult['trend'] {
  if (scores.length < 3) return 'stable';

  // Simple linear regression
  const n = scores.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = scores.reduce((a, b) => a + b, 0);
  const sumXY = scores.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  if (Math.abs(slope) < 0.1) return 'stable';
  if (slope > 0.5) return 'increasing';
  if (slope < -0.5) return 'decreasing';
  return 'erratic';
}

/**
 * Compute deterministic drift hash
 */
function computeDriftHash(result: Omit<DriftResult, 'resultHash' | 'analyzedAt'>): string {
  const stableObj = {
    baselineRunId: result.baselineRunId,
    windowSize: result.windowSize,
    comparisonCount: result.comparisons.length,
    averageDrift: Math.round(result.averageDrift * 100) / 100,
    maxDrift: result.maxDrift,
    trend: result.trend,
    hasDivergence: result.firstDivergence !== null,
  };

  const json = JSON.stringify(stableObj, Object.keys(stableObj).sort());
  return hash(json).substring(0, 32);
}

/**
 * Format drift result as table
 */
export function formatDriftAsTable(result: DriftResult): string {
  const lines: string[] = [
    '┌────────────────────────────────────────────────────────────┐',
    '│ DRIFT ANALYSIS                                             │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Baseline:    ${result.baselineRunId.substring(0, 40).padEnd(40)}│`,
    `│  Window:      ${result.windowSize.toString().padEnd(40)}│`,
    `│  Trend:       ${result.trend.padEnd(40)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  Average Drift: ${result.averageDrift.toFixed(2).padEnd(38)}│`,
    `│  Max Drift:     ${result.maxDrift.toFixed(2).padEnd(38)}│`,
  ];

  if (result.firstDivergence) {
    lines.push('├────────────────────────────────────────────────────────────┤');
    lines.push('│  FIRST DIVERGENCE                                          │');
    lines.push(`│  Run: ${result.firstDivergence.comparedRunId.substring(0, 46).padEnd(46)}│`);
    lines.push(`│  Score: ${result.firstDivergence.overallScore.toString().padEnd(44)}│`);
    lines.push(`│  Severity: ${result.firstDivergence.severity.padEnd(41)}│`);
  }

  if (result.comparisons.length > 0) {
    lines.push('├────────────────────────────────────────────────────────────┤');
    lines.push('│  TOP DRIFTS                                                │');
    const topDrifts = result.comparisons
      .filter(c => c.overallScore > 0)
      .slice(-5)
      .reverse();

    for (const comp of topDrifts) {
      const icon = comp.severity === 'critical' ? '🔴' :
                   comp.severity === 'high' ? '🟠' :
                   comp.severity === 'medium' ? '🟡' : '⚪';
      lines.push(`│  ${icon} ${comp.comparedRunId.substring(0, 20)}... Score: ${comp.overallScore.toString().padEnd(3)}│`);
    }
  }

  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push(`│  Hash: ${result.resultHash.substring(0, 16)}...`.padEnd(61) + '│');
  lines.push('└────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

/**
 * Format drift result as JSON
 */
export function formatDriftAsJson(result: DriftResult): Record<string, unknown> {
  return {
    baselineRunId: result.baselineRunId,
    windowSize: result.windowSize,
    averageDrift: result.averageDrift,
    maxDrift: result.maxDrift,
    trend: result.trend,
    firstDivergence: result.firstDivergence ? {
      runId: result.firstDivergence.comparedRunId,
      score: result.firstDivergence.overallScore,
      severity: result.firstDivergence.severity,
    } : null,
    resultHash: result.resultHash,
  };
}

