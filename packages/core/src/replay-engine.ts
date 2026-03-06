/**
 * Replay Engine
 *
 * Enables deterministic replay of any execution from its proof pack.
 * Supports:
 *   - Full replay with step-by-step verification
 *   - Deterministic diffing between runs
 *   - Policy decision inspection
 *   - Tool I/O inspection
 *   - Artifact provenance tracing
 */

import { canonicalStringify } from './canonical-json.js';
import { blake3Hex } from './hash.js';
import type {
  ExecutionStep,
  ExecutionResult,
  ProofBundle,
  ProofPack,
  PolicyEvalResult,
  EventRecord,
} from './execution-contract.js';

// ---------------------------------------------------------------------------
// Replay Types
// ---------------------------------------------------------------------------

export interface ReplayResult {
  run_id: string;
  replay_id: string;
  original_digest: string;
  replay_digest: string;
  match: boolean;
  match_percentage: number;
  step_results: StepReplayResult[];
  policy_match: boolean;
  artifact_match: boolean;
  divergence_point?: number; // step seq where divergence first occurs
  divergence_reason?: string;
  duration_ms: number;
}

export interface StepReplayResult {
  seq: number;
  step_type: string;
  original_hash: string;
  replay_hash: string;
  match: boolean;
  diff?: StepDiff;
}

export interface StepDiff {
  field: string;
  original: unknown;
  replayed: unknown;
}

export interface RunDiff {
  diff_id: string;
  run_a_id: string;
  run_b_id: string;
  created_at: string;
  overall_match_percentage: number;
  step_diffs: StepCompare[];
  policy_diffs: PolicyCompare[];
  metric_diffs: MetricCompare[];
  artifact_diffs: ArtifactCompare[];
}

export interface StepCompare {
  seq: number;
  step_type: string;
  status: 'identical' | 'modified' | 'added' | 'removed';
  hash_a?: string;
  hash_b?: string;
  changes?: Array<{ field: string; value_a: unknown; value_b: unknown }>;
}

export interface PolicyCompare {
  rule_id: string;
  decision_a: string;
  decision_b: string;
  match: boolean;
}

export interface MetricCompare {
  metric: string;
  value_a: number;
  value_b: number;
  delta: number;
  delta_pct: number;
}

export interface ArtifactCompare {
  filename: string;
  status: 'identical' | 'modified' | 'added' | 'removed';
  hash_a?: string;
  hash_b?: string;
}

// ---------------------------------------------------------------------------
// Replay Engine
// ---------------------------------------------------------------------------

export class ReplayEngine {
  /**
   * Replay a proof pack and verify deterministic reproduction.
   * In real execution this would re-execute tool calls; here we verify
   * the recorded hashes match the proof bundle.
   */
  replay(pack: ProofPack): ReplayResult {
    const startTime = Date.now();
    const replayId = `replay_${blake3Hex(pack.manifest.run_id + Date.now().toString()).substring(0, 16)}`;

    const stepResults: StepReplayResult[] = [];
    let firstDivergence: number | undefined;
    let divergenceReason: string | undefined;

    // Verify each step's data hash
    for (const step of pack.run_log) {
      const computedHash = blake3Hex(canonicalStringify(step));
      const match = computedHash === step.data_hash;

      stepResults.push({
        seq: step.seq,
        step_type: step.step_type,
        original_hash: step.data_hash,
        replay_hash: computedHash,
        match,
      });

      if (!match && firstDivergence === undefined) {
        firstDivergence = step.seq;
        divergenceReason = `Step ${step.seq} (${step.step_type}) hash mismatch`;
      }
    }

    // Verify policy evaluations
    const policyMatch = pack.policy_evaluations.every(pe => {
      const computed = blake3Hex(canonicalStringify(pe));
      return computed === pe.proof_hash || pe.proof_hash === '';
    });

    // Verify artifact digests
    const artifactMatch = Object.entries(pack.artifacts).every(([filename, casAddress]) => {
      return pack.manifest.output_digests[filename] === casAddress ||
             !pack.manifest.output_digests[filename];
    });

    const matchingSteps = stepResults.filter(s => s.match).length;
    const matchPercentage = stepResults.length > 0
      ? (matchingSteps / stepResults.length) * 100
      : 100;

    return {
      run_id: pack.manifest.run_id,
      replay_id: replayId,
      original_digest: pack.manifest.request_digest,
      replay_digest: blake3Hex(canonicalStringify(stepResults)),
      match: firstDivergence === undefined && policyMatch && artifactMatch,
      match_percentage: matchPercentage,
      step_results: stepResults,
      policy_match: policyMatch,
      artifact_match: artifactMatch,
      divergence_point: firstDivergence,
      divergence_reason: divergenceReason,
      duration_ms: Date.now() - startTime,
    };
  }

  /**
   * Compute a deterministic diff between two runs.
   */
  diff(
    runA: { id: string; steps: ExecutionStep[]; policies: PolicyEvalResult[]; metrics: Record<string, number>; artifacts: Record<string, string> },
    runB: { id: string; steps: ExecutionStep[]; policies: PolicyEvalResult[]; metrics: Record<string, number>; artifacts: Record<string, string> },
  ): RunDiff {
    const stepDiffs = this.diffSteps(runA.steps, runB.steps);
    const policyDiffs = this.diffPolicies(runA.policies, runB.policies);
    const metricDiffs = this.diffMetrics(runA.metrics, runB.metrics);
    const artifactDiffs = this.diffArtifacts(runA.artifacts, runB.artifacts);

    const totalComparisons = stepDiffs.length + policyDiffs.length + artifactDiffs.length;
    const matchCount = stepDiffs.filter(s => s.status === 'identical').length
      + policyDiffs.filter(p => p.match).length
      + artifactDiffs.filter(a => a.status === 'identical').length;
    const matchPct = totalComparisons > 0 ? (matchCount / totalComparisons) * 100 : 100;

    return {
      diff_id: `diff_${blake3Hex(runA.id + runB.id).substring(0, 16)}`,
      run_a_id: runA.id,
      run_b_id: runB.id,
      created_at: new Date().toISOString(),
      overall_match_percentage: Math.round(matchPct * 100) / 100,
      step_diffs: stepDiffs,
      policy_diffs: policyDiffs,
      metric_diffs: metricDiffs,
      artifact_diffs: artifactDiffs,
    };
  }

  private diffSteps(stepsA: ExecutionStep[], stepsB: ExecutionStep[]): StepCompare[] {
    const results: StepCompare[] = [];
    const maxLen = Math.max(stepsA.length, stepsB.length);

    for (let i = 0; i < maxLen; i++) {
      const a = stepsA[i];
      const b = stepsB[i];

      if (!a) {
        results.push({ seq: i, step_type: b.step_type, status: 'added', hash_b: b.data_hash });
      } else if (!b) {
        results.push({ seq: i, step_type: a.step_type, status: 'removed', hash_a: a.data_hash });
      } else {
        const hashA = blake3Hex(canonicalStringify(a));
        const hashB = blake3Hex(canonicalStringify(b));
        if (hashA === hashB) {
          results.push({ seq: i, step_type: a.step_type, status: 'identical', hash_a: hashA, hash_b: hashB });
        } else {
          results.push({
            seq: i,
            step_type: a.step_type,
            status: 'modified',
            hash_a: hashA,
            hash_b: hashB,
            changes: this.findChanges(a, b),
          });
        }
      }
    }
    return results;
  }

  private diffPolicies(policiesA: PolicyEvalResult[], policiesB: PolicyEvalResult[]): PolicyCompare[] {
    const results: PolicyCompare[] = [];
    const allRuleIds = new Set([
      ...policiesA.map(p => p.matched_rule_id),
      ...policiesB.map(p => p.matched_rule_id),
    ]);

    for (const ruleId of allRuleIds) {
      const a = policiesA.find(p => p.matched_rule_id === ruleId);
      const b = policiesB.find(p => p.matched_rule_id === ruleId);
      results.push({
        rule_id: ruleId,
        decision_a: a?.decision || '(absent)',
        decision_b: b?.decision || '(absent)',
        match: a?.decision === b?.decision,
      });
    }
    return results;
  }

  private diffMetrics(metricsA: Record<string, number>, metricsB: Record<string, number>): MetricCompare[] {
    const results: MetricCompare[] = [];
    const allKeys = new Set([...Object.keys(metricsA), ...Object.keys(metricsB)]);

    for (const key of allKeys) {
      const a = metricsA[key] || 0;
      const b = metricsB[key] || 0;
      const delta = b - a;
      const deltaPct = a !== 0 ? (delta / a) * 100 : (b !== 0 ? 100 : 0);
      results.push({ metric: key, value_a: a, value_b: b, delta, delta_pct: Math.round(deltaPct * 100) / 100 });
    }
    return results;
  }

  private diffArtifacts(artifactsA: Record<string, string>, artifactsB: Record<string, string>): ArtifactCompare[] {
    const results: ArtifactCompare[] = [];
    const allFiles = new Set([...Object.keys(artifactsA), ...Object.keys(artifactsB)]);

    for (const file of allFiles) {
      const hashA = artifactsA[file];
      const hashB = artifactsB[file];
      if (!hashA) {
        results.push({ filename: file, status: 'added', hash_b: hashB });
      } else if (!hashB) {
        results.push({ filename: file, status: 'removed', hash_a: hashA });
      } else if (hashA === hashB) {
        results.push({ filename: file, status: 'identical', hash_a: hashA, hash_b: hashB });
      } else {
        results.push({ filename: file, status: 'modified', hash_a: hashA, hash_b: hashB });
      }
    }
    return results;
  }

  private findChanges(a: unknown, b: unknown): Array<{ field: string; value_a: unknown; value_b: unknown }> {
    const changes: Array<{ field: string; value_a: unknown; value_b: unknown }> = [];
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
      changes.push({ field: '(root)', value_a: a, value_b: b });
      return changes;
    }

    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

    for (const key of allKeys) {
      if (JSON.stringify(objA[key]) !== JSON.stringify(objB[key])) {
        changes.push({ field: key, value_a: objA[key], value_b: objB[key] });
      }
    }
    return changes;
  }
}
