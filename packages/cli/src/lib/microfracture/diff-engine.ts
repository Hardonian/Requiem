/**
 * Diff Engine — Deterministic comparison of run records
 *
 * INVARIANT: All operations are deterministic (no time, randomness, network)
 * INVARIANT: Output is stably ordered for consistent hashing
 * INVARIANT: No raw inputs exposed without redaction policy
 */

import { hash } from '../hash.js';

export interface DiffInput {
  digest: string;
  preview?: unknown;
}

export interface DiffOutput {
  digest: string;
  structured?: Record<string, unknown>;
}

export interface PolicyDelta {
  rulesTriggered: string[];
  decisions: Array<{ rule: string; action: 'allow' | 'deny' | 'modify' }>;
}

export interface GraphDelta {
  nodesAdded: string[];
  nodesRemoved: string[];
  edgesChanged: Array<{ from: string; to: string; change: 'added' | 'removed' | 'modified' }>;
}

export interface RunDiffResult {
  runA: string;
  runB: string;
  inputDelta: {
    digestA: string;
    digestB: string;
    changed: boolean;
    previewA?: unknown;
    previewB?: unknown;
  };
  outputDelta: {
    digestA: string | null;
    digestB: string | null;
    changed: boolean;
    structuredA?: Record<string, unknown>;
    structuredB?: Record<string, unknown>;
  };
  policyDelta: PolicyDelta | null;
  graphDelta: GraphDelta | null;
  fingerprintMismatch: boolean;
  deterministic: boolean;
  firstDivergenceStep: number | null;
  diffDigest: string;
  createdAt: string; // Display only - not used in diffDigest
}

export interface RunRecord {
  id: string;
  tenantId: string;
  inputFingerprint: string;
  outputFingerprint: string | null;
  executionFingerprint: string | null;
  replayVerified: boolean;
  replayMatchPercent: number;
  policyDecisions?: Array<{ rule: string; action: string; reason?: string }>;
  graphDigest?: string | null;
  trace?: Array<{ step: number; tool: string; inputDigest: string; outputDigest: string | null }>;
}

/**
 * Compute deterministic diff between two runs
 * All comparisons use digests, not raw content
 */
export function computeDiff(runA: RunRecord, runB: RunRecord, redaction: 'safe' | 'full' = 'safe'): RunDiffResult {
  // Input comparison (always digest-based)
  const inputChanged = runA.inputFingerprint !== runB.inputFingerprint;

  // Output comparison
  const outputChanged = runA.outputFingerprint !== runB.outputFingerprint;

  // Policy comparison
  const policyDelta = computePolicyDelta(runA.policyDecisions, runB.policyDecisions);

  // Graph comparison
  const graphDelta = computeGraphDelta(runA.graphDigest, runB.graphDigest);

  // Find first divergence in trace
  const firstDivergenceStep = findFirstDivergence(runA.trace, runB.trace);

  // Determine determinism
  const deterministic = !inputChanged && !outputChanged && firstDivergenceStep === null;

  // Build result (without diffDigest first)
  const result: Omit<RunDiffResult, 'diffDigest'> = {
    runA: runA.id,
    runB: runB.id,
    inputDelta: {
      digestA: runA.inputFingerprint,
      digestB: runB.inputFingerprint,
      changed: inputChanged,
      previewA: redaction === 'full' ? undefined : undefined, // Placeholder for redacted preview
      previewB: redaction === 'full' ? undefined : undefined,
    },
    outputDelta: {
      digestA: runA.outputFingerprint,
      digestB: runB.outputFingerprint,
      changed: outputChanged,
    },
    policyDelta,
    graphDelta,
    fingerprintMismatch: inputChanged || outputChanged,
    deterministic,
    firstDivergenceStep,
    createdAt: new Date().toISOString(), // Display only
  };

  // Compute stable diff digest (excluding createdAt)
  const diffDigest = computeDiffDigest(result);

  return {
    ...result,
    diffDigest,
  };
}

/**
 * Compute policy delta between two runs
 */
function computePolicyDelta(
  a?: Array<{ rule: string; action: string }>,
  b?: Array<{ rule: string; action: string }>
): PolicyDelta | null {
  if (!a && !b) return null;

  const rulesA = new Set(a?.map(d => d.rule) || []);
  const rulesB = new Set(b?.map(d => d.rule) || []);

  const allRules = new Set([...rulesA, ...rulesB]);
  const triggered: string[] = [];
  const decisions: Array<{ rule: string; action: 'allow' | 'deny' | 'modify' }> = [];

  for (const rule of allRules) {
    const decA = a?.find(d => d.rule === rule);
    const decB = b?.find(d => d.rule === rule);

    if (decA?.action !== decB?.action) {
      triggered.push(rule);
      if (decA) {
        decisions.push({ rule, action: decA.action as 'allow' | 'deny' | 'modify' });
      }
      if (decB) {
        decisions.push({ rule, action: decB.action as 'allow' | 'deny' | 'modify' });
      }
    }
  }

  if (triggered.length === 0) return null;

  // Stable ordering
  triggered.sort();
  decisions.sort((x, y) => x.rule.localeCompare(y.rule));

  return { rulesTriggered: triggered, decisions };
}

/**
 * Compute graph delta between two runs
 */
function computeGraphDelta(a?: string | null, b?: string | null): GraphDelta | null {
  if (a === b) return null;

  // Simplified: just track that graph changed
  // Full implementation would decode graph structures
  return {
    nodesAdded: [],
    nodesRemoved: [],
    edgesChanged: [{
      from: 'graph',
      to: 'digest',
      change: 'modified',
    }],
  };
}

/**
 * Find first divergence point in execution traces
 */
function findFirstDivergence(
  traceA?: Array<{ step: number; outputDigest: string | null }>,
  traceB?: Array<{ step: number; outputDigest: string | null }>
): number | null {
  if (!traceA || !traceB) return null;

  const maxSteps = Math.max(traceA.length, traceB.length);

  for (let i = 0; i < maxSteps; i++) {
    const stepA = traceA[i];
    const stepB = traceB[i];

    if (!stepA || !stepB) return i;
    if (stepA.outputDigest !== stepB.outputDigest) return i;
  }

  return null;
}

/**
 * Compute deterministic diff digest
 * Uses stable JSON ordering
 */
function computeDiffDigest(result: Omit<RunDiffResult, 'diffDigest' | 'createdAt'>): string {
  const stableObj = {
    runA: result.runA,
    runB: result.runB,
    inputChanged: result.inputDelta.changed,
    outputChanged: result.outputDelta.changed,
    policyChanged: result.policyDelta !== null,
    graphChanged: result.graphDelta !== null,
    deterministic: result.deterministic,
    firstDivergence: result.firstDivergenceStep,
  };

  const stableJson = JSON.stringify(stableObj, Object.keys(stableObj).sort());
  return hash(stableJson);
}

/**
 * Format diff result as table (for CLI output)
 */
export function formatDiffAsTable(diff: RunDiffResult): string {
  const lines: string[] = [
    '┌────────────────────────────────────────────────────────────┐',
    '│ DETERMINISTIC DIFF                                         │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Run A:       ${diff.runA.substring(0, 40).padEnd(40)}│`,
    `│  Run B:       ${diff.runB.substring(0, 40).padEnd(40)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  Deterministic: ${diff.deterministic ? 'YES ✓' : 'NO ✗'}`.padEnd(61) + '│',
    `│  Input Match:  ${!diff.inputDelta.changed ? 'YES ✓' : 'NO ✗'}`.padEnd(61) + '│',
    `│  Output Match: ${!diff.outputDelta.changed ? 'YES ✓' : 'NO ✗'}`.padEnd(61) + '│',
  ];

  if (diff.firstDivergenceStep !== null) {
    lines.push(`│  Divergence:   Step ${diff.firstDivergenceStep + 1}`.padEnd(61) + '│');
  }

  if (diff.policyDelta) {
    lines.push(`│  Policy Diff:  ${diff.policyDelta.rulesTriggered.length} rules`.padEnd(61) + '│');
  }

  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push(`│  Diff Digest: ${diff.diffDigest.substring(0, 16)}...`.padEnd(61) + '│');
  lines.push('└────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

/**
 * Get top 3 deltas for proof card
 */
export function getTopDeltas(diff: RunDiffResult): Array<{ type: string; severity: 'high' | 'medium' | 'low'; summary: string }> {
  const deltas: Array<{ type: string; severity: 'high' | 'medium' | 'low'; summary: string }> = [];

  if (diff.inputDelta.changed) {
    deltas.push({
      type: 'input',
      severity: 'high',
      summary: `Input fingerprint differs: ${diff.inputDelta.digestA.substring(0, 8)}... vs ${diff.inputDelta.digestB.substring(0, 8)}...`,
    });
  }

  if (diff.outputDelta.changed) {
    deltas.push({
      type: 'output',
      severity: 'high',
      summary: `Output fingerprint differs: ${(diff.outputDelta.digestA || 'null').substring(0, 8)}... vs ${(diff.outputDelta.digestB || 'null').substring(0, 8)}...`,
    });
  }

  if (diff.policyDelta) {
    deltas.push({
      type: 'policy',
      severity: 'medium',
      summary: `${diff.policyDelta.rulesTriggered.length} policy rules differ`,
    });
  }

  if (diff.graphDelta) {
    deltas.push({
      type: 'graph',
      severity: 'low',
      summary: 'Execution graph structure differs',
    });
  }

  // Return top 3 by severity
  return deltas
    .sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 3);
}

