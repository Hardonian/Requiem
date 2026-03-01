/**
 * Symmetry Engine
 * 
 * Computes deterministic symmetry metrics:
 * - Technical symmetry
 * - Strategic symmetry
 * - Economic symmetry
 * 
 * All metrics are pure functions of stored metadata.
 */

import {
  LearningSignalRepository,
  LearningPatchRepository,
  SymmetryMetricRepository,
  EconomicEventRepository,
  SkillRepository,
  type MetricName,
  type LearningSignal,
  type LearningPatch,
} from '../db/governance';
import { analyzeSignals } from './drift-detector';

// ─── Technical Symmetry ────────────────────────────────────────────────────────

export interface TechnicalSymmetry {
  failureRecurrenceRate: number;
  driftSeverityScore: number;
  replayMismatchRate: number;
  timeToGreen: number;
}

/**
 * Calculate technical symmetry metrics.
 * Deterministic based on stored data.
 */
export function calculateTechnicalSymmetry(
  tenantId: string,
  since?: Date
): TechnicalSymmetry {
  const signals = LearningSignalRepository.findAllByTenant(tenantId, since);
  
  // Failure recurrence rate
  const totalSignals = signals.length || 1;
  const failureSignals = signals.filter(s => 
    ['build_failure', 'test_failure', 'policy_violation'].includes(s.category)
  ).length;
  const failureRecurrenceRate = failureSignals / totalSignals;
  
  // Drift severity score
  const driftSignals = signals.filter(s => s.category === 'drift');
  const driftScores = driftSignals.map(s => 
    (s.metadata_json?.severity as number) || 0
  );
  const driftSeverityScore = driftScores.length > 0
    ? driftScores.reduce((a, b) => a + b, 0) / driftScores.length
    : 0;
  
  // Replay mismatch rate
  const replaySignals = signals.filter(s => s.category === 'replay_mismatch');
  const replayMismatchRate = replaySignals.length / totalSignals;
  
  // Time to green (average verification cycles)
  const verificationCycles = signals
    .filter(s => s.metadata_json?.verification_cycles !== undefined)
    .map(s => s.metadata_json?.verification_cycles as number);
  const timeToGreen = verificationCycles.length > 0
    ? verificationCycles.reduce((a, b) => a + b, 0) / verificationCycles.length
    : 0;
  
  return {
    failureRecurrenceRate,
    driftSeverityScore,
    replayMismatchRate,
    timeToGreen,
  };
}

// ─── Strategic Symmetry ────────────────────────────────────────────────────────

export interface StrategicSymmetry {
  rollbackFrequency: number;
  skillCoverageRatio: number;
  instructionCoverageScore: number;
}

/**
 * Calculate strategic symmetry metrics.
 */
export function calculateStrategicSymmetry(
  tenantId: string,
  since?: Date
): StrategicSymmetry {
  const signals = LearningSignalRepository.findAllByTenant(tenantId, since);
  const patches = LearningPatchRepository.findByTenant(tenantId);
  
  // Rollback frequency
  const rollbackSignals = signals.filter(s => s.category === 'rollback_event');
  const rollbackFrequency = rollbackSignals.length;
  
  // Skill coverage ratio
  const allSkills = SkillRepository.findAll();
  const signalCategories = new Set(signals.map(s => s.category));
  let coveredCategories = 0;
  
  for (const category of signalCategories) {
    const skills = SkillRepository.findByTrigger(category);
    if (skills.length > 0) {
      coveredCategories++;
    }
  }
  
  const skillCoverageRatio = signalCategories.size > 0
    ? coveredCategories / signalCategories.size
    : 1;
  
  // Instruction coverage score
  // Based on number of patches that were successfully applied
  const appliedPatches = patches.filter(p => p.status === 'applied');
  const instructionCoverageScore = patches.length > 0
    ? appliedPatches.length / patches.length
    : 1;
  
  return {
    rollbackFrequency,
    skillCoverageRatio,
    instructionCoverageScore,
  };
}

// ─── Economic Symmetry ─────────────────────────────────────────────────────────

export interface EconomicSymmetry {
  burnRate: number;
  costPerVerifiedRun: number;
  replayEfficiencyRatio: number;
  fairnessIndex: number;
}

/**
 * Calculate economic symmetry metrics.
 */
export function calculateEconomicSymmetry(
  tenantId: string,
  since?: Date
): EconomicSymmetry {
  const events = EconomicEventRepository.findByTenant(tenantId, since);
  
  // Sum costs by type
  let totalCost = 0;
  let executionCount = 0;
  let storageCost = 0;
  let policyCost = 0;
  
  for (const event of events) {
    totalCost += event.cost_units;
    
    if (event.event_type === 'execution') {
      executionCount++;
    } else if (event.event_type === 'replay_storage') {
      storageCost += event.cost_units;
    } else if (event.event_type === 'policy_eval') {
      policyCost += event.cost_units;
    }
  }
  
  // Burn rate (cost per period - normalized to per-hour)
  const hoursInPeriod = since ? (Date.now() - since.getTime()) / 3600000 : 24;
  const burnRate = totalCost / Math.max(hoursInPeriod, 1);
  
  // Cost per verified run
  const verifiedRuns = executionCount; // Simplified
  const costPerVerifiedRun = verifiedRuns > 0 ? totalCost / verifiedRuns : 0;
  
  // Replay efficiency ratio
  const replayEvents = events.filter(e => e.event_type === 'execution');
  const replayEfficiencyRatio = replayEvents.length > 0 
    ? 1 - (replayEvents.filter(e => e.resource_units > 0).length / replayEvents.length)
    : 1;
  
  // Fairness index (placeholder - would need tenant distribution data)
  const fairnessIndex = 1; // Perfectly fair by default
  
  return {
    burnRate,
    costPerVerifiedRun,
    replayEfficiencyRatio,
    fairnessIndex,
  };
}

// ─── Combined Symmetry ─────────────────────────────────────────────────────────

export interface SymmetryScore {
  technical: TechnicalSymmetry;
  strategic: StrategicSymmetry;
  economic: EconomicSymmetry;
  overallScore: number;
}

/**
 * Calculate all symmetry metrics and produce an overall score.
 */
export function calculateSymmetry(tenantId: string, since?: Date): SymmetryScore {
  const technical = calculateTechnicalSymmetry(tenantId, since);
  const strategic = calculateStrategicSymmetry(tenantId, since);
  const economic = calculateEconomicSymmetry(tenantId, since);
  
  // Overall score: weighted average of normalized metrics
  // Perfect symmetry = 100
  const technicalScore = (
    (1 - technical.failureRecurrenceRate) * 25 +
    (1 - technical.driftSeverityScore / 100) * 25 +
    (1 - technical.replayMismatchRate) * 25 +
    (1 - Math.min(technical.timeToGreen / 10, 1)) * 25
  );
  
  const strategicScore = (
    (1 - Math.min(strategic.rollbackFrequency / 10, 1)) * 33.33 +
    strategic.skillCoverageRatio * 33.33 +
    strategic.instructionCoverageScore * 33.34
  );
  
  const economicScore = (
    (1 - Math.min(economic.burnRate / 1000, 1)) * 25 +
    (1 - Math.min(economic.costPerVerifiedRun / 100, 1)) * 25 +
    economic.replayEfficiencyRatio * 25 +
    economic.fairnessIndex * 25
  );
  
  const overallScore = (technicalScore + strategicScore + economicScore) / 3;
  
  return {
    technical,
    strategic,
    economic,
    overallScore: Math.round(overallScore * 100) / 100,
  };
}

// ─── Persist Symmetry Metrics ─────────────────────────────────────────────────

export interface PersistSymmetryParams {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Persist symmetry metrics for a period.
 */
export function persistSymmetryMetrics(params: PersistSymmetryParams): void {
  const symmetry = calculateSymmetry(params.tenantId, params.periodStart);
  
  // Technical metrics
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'failure_recurrence_rate',
    metricValue: symmetry.technical.failureRecurrenceRate,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'drift_severity_score',
    metricValue: symmetry.technical.driftSeverityScore,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'replay_mismatch_rate',
    metricValue: symmetry.technical.replayMismatchRate,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'time_to_green',
    metricValue: symmetry.technical.timeToGreen,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  // Strategic metrics
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'rollback_frequency',
    metricValue: symmetry.strategic.rollbackFrequency,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'skill_coverage_ratio',
    metricValue: symmetry.strategic.skillCoverageRatio,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'instruction_coverage_score',
    metricValue: symmetry.strategic.instructionCoverageScore,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  // Economic metrics
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'burn_rate',
    metricValue: symmetry.economic.burnRate,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'cost_per_verified_run',
    metricValue: symmetry.economic.costPerVerifiedRun,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'replay_efficiency_ratio',
    metricValue: symmetry.economic.replayEfficiencyRatio,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  
  SymmetryMetricRepository.create({
    tenantId: params.tenantId,
    metricName: 'fairness_index',
    metricValue: symmetry.economic.fairnessIndex,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
}
