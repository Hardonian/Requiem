/**
 * Drift and Pattern Detection Engine
 * 
 * Deterministic analyzers for detecting:
 * - Recurring failures
 * - Prompt ambiguities
 * - Skill coverage gaps
 * - Rollback frequency
 * - Time-to-green metrics
 * 
 * All analyzers are pure functions with no randomness.
 */

import { 
  LearningSignalRepository, 
  type SignalCategory,
  type LearningSignal 
} from '../db/governance';

// ─── Signal Category Thresholds ─────────────────────────────────────────────────

const SIGNAL_THRESHOLDS: Record<SignalCategory, number> = {
  build_failure: 1,
  drift: 1,
  policy_violation: 1,
  replay_mismatch: 1,
  test_failure: 1,
  schema_gap: 1,
  skill_gap: 1,
  rollback_event: 1,
  cost_spike: 1,
  fairness_violation: 1,
};

// ─── Root Cause Mapping ───────────────────────────────────────────────────────

const SIGNAL_TO_ROOT_CAUSE: Record<SignalCategory, string> = {
  build_failure: 'config_gap',
  drift: 'strategic_misalignment',
  policy_violation: 'policy_gap',
  replay_mismatch: 'config_gap',
  test_failure: 'config_gap',
  schema_gap: 'schema_gap',
  skill_gap: 'skill_gap',
  rollback_event: 'strategic_misalignment',
  cost_spike: 'economic_misalignment',
  fairness_violation: 'economic_misalignment',
};

// ─── Confidence Score Calculator ────────────────────────────────────────────────

/**
 * Calculate confidence score based on signal count.
 * Deterministic: score depends only on signal count.
 */
export function calculateConfidenceScore(signalCount: number): number {
  if (signalCount >= 4) return 90;
  if (signalCount >= 2) return 60;
  return 30;
}

// ─── Recurring Failure Detector ───────────────────────────────────────────────

export interface FailureDetectionResult {
  category: SignalCategory;
  count: number;
  threshold: number;
  triggersDiagnosis: boolean;
}

/**
 * Detect recurring failures by category.
 * Returns categories that exceed threshold.
 */
export function detectRecurringFailures(
  signals: LearningSignal[]
): FailureDetectionResult[] {
  const counts: Partial<Record<SignalCategory, number>> = {};
  
  for (const signal of signals) {
    counts[signal.category] = (counts[signal.category] || 0) + 1;
  }
  
  const results: FailureDetectionResult[] = [];
  
  for (const [category, count] of Object.entries(counts)) {
    const threshold = SIGNAL_THRESHOLDS[category as SignalCategory] || 1;
    results.push({
      category: category as SignalCategory,
      count,
      threshold,
      triggersDiagnosis: count >= threshold,
    });
  }
  
  // Sort by count descending for deterministic ordering
  return results.sort((a, b) => b.count - a.count);
}

// ─── Prompt Ambiguity Detector ───────────────────────────────────────────────

export interface AmbiguityDetectionResult {
  missingInputs: string[];
  fallbackFrequency: number;
}

/**
 * Detect prompt ambiguities by checking for missing required inputs
 * and fallback branch frequency.
 */
export function detectPromptAmbiguities(
  signals: LearningSignal[],
  expectedInputs: Record<string, string[]>
): AmbiguityDetectionResult {
  const missingInputs: string[] = [];
  let fallbackCount = 0;
  
  for (const signal of signals) {
    const metadata = signal.metadata_json;
    if (!metadata) continue;
    
    // Check for missing inputs
    const inputs = metadata.inputs as Record<string, unknown> | undefined;
    if (inputs) {
      const expected = expectedInputs[signal.category] || [];
      for (const exp of expected) {
        if (!(exp in (inputs || {}))) {
          if (!missingInputs.includes(exp)) {
            missingInputs.push(exp);
          }
        }
      }
    }
    
    // Check for fallback branch usage
    const usedFallback = metadata.used_fallback as boolean | undefined;
    if (usedFallback) {
      fallbackCount++;
    }
  }
  
  const totalSignals = signals.length || 1;
  const fallbackFrequency = fallbackCount / totalSignals;
  
  return {
    missingInputs,
    fallbackFrequency,
  };
}

// ─── Skill Coverage Detector ─────────────────────────────────────────────────

export interface SkillCoverageResult {
  covered: SignalCategory[];
  uncovered: SignalCategory[];
  coverageRatio: number;
}

/**
 * Map signal categories to skill registry coverage.
 */
export function detectSkillCoverage(
  signals: LearningSignal[],
  skillTriggers: Record<SignalCategory, string[]> // category -> skill IDs
): SkillCoverageResult {
  const signalCategories = new Set<SignalCategory>();
  for (const signal of signals) {
    signalCategories.add(signal.category);
  }
  
  const covered: SignalCategory[] = [];
  const uncovered: SignalCategory[] = [];
  
  for (const category of signalCategories) {
    const skills = skillTriggers[category];
    if (skills && skills.length > 0) {
      covered.push(category);
    } else {
      uncovered.push(category);
    }
  }
  
  const total = signalCategories.size || 1;
  const coverageRatio = covered.length / total;
  
  return {
    covered,
    uncovered,
    coverageRatio,
  };
}

// ─── Rollback Frequency Tracker ───────────────────────────────────────────────

export interface RollbackFrequencyResult {
  rollbackCount: number;
  totalSignals: number;
  frequency: number;
}

/**
 * Count rollbacks over a fixed period.
 */
export function trackRollbackFrequency(signals: LearningSignal[]): RollbackFrequencyResult {
  const rollbackSignals = signals.filter(s => s.category === 'rollback_event');
  const rollbackCount = rollbackSignals.length;
  const totalSignals = signals.length || 1;
  
  return {
    rollbackCount,
    totalSignals,
    frequency: rollbackCount / totalSignals,
  };
}

// ─── Time-to-Green Calculator ─────────────────────────────────────────────────

export interface TimeToGreenResult {
  totalCycles: number;
  successfulCycles: number;
  averageCycles: number;
}

/**
 * Measure cycles until full verify passes.
 * Uses signal metadata to track verification attempts.
 */
export function calculateTimeToGreen(
  signals: LearningSignal[]
): TimeToGreenResult {
  let totalCycles = 0;
  let successfulCycles = 0;
  
  for (const signal of signals) {
    const metadata = signal.metadata_json;
    if (!metadata) continue;
    
    const cycles = metadata.verification_cycles as number | undefined;
    const passed = metadata.verification_passed as boolean | undefined;
    
    if (cycles !== undefined) {
      totalCycles += cycles;
      if (passed) {
        successfulCycles++;
      }
    }
  }
  
  const signalCount = signals.length || 1;
  
  return {
    totalCycles,
    successfulCycles,
    averageCycles: totalCycles / signalCount,
  };
}

// ─── Root Cause Determinator ─────────────────────────────────────────────────

export interface RootCauseResult {
  rootCause: string;
  confidenceScore: number;
  relatedSignals: SignalCategory[];
}

/**
 * Map signals to deterministic root cause.
 */
export function determineRootCause(
  signals: LearningSignal[]
): RootCauseResult | null {
  if (signals.length === 0) return null;
  
  const categoryCounts = new Map<SignalCategory, number>();
  for (const signal of signals) {
    const count = categoryCounts.get(signal.category) || 0;
    categoryCounts.set(signal.category, count + 1);
  }
  
  // Find the dominant category
  let dominantCategory: SignalCategory | null = null;
  let maxCount = 0;
  
  for (const [category, count] of categoryCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = category;
    }
  }
  
  if (!dominantCategory) return null;
  
  const rootCause = SIGNAL_TO_ROOT_CAUSE[dominantCategory] || 'strategic_misalignment';
  const confidenceScore = calculateConfidenceScore(maxCount);
  
  return {
    rootCause,
    confidenceScore,
    relatedSignals: [dominantCategory],
  };
}

// ─── Signal Processor ─────────────────────────────────────────────────────────

export interface SignalAnalysis {
  recurringFailures: FailureDetectionResult[];
  skillCoverage: SkillCoverageResult;
  rollbackFrequency: RollbackFrequencyResult;
  timeToGreen: TimeToGreenResult;
  hasSignificantDrift: boolean;
}

/**
 * Process all signals and produce deterministic analysis.
 */
export function analyzeSignals(
  signals: LearningSignal[],
  skillTriggers: Record<SignalCategory, string[]> = {}
): SignalAnalysis {
  const recurringFailures = detectRecurringFailures(signals);
  const skillCoverage = detectSkillCoverage(signals, skillTriggers);
  const rollbackFrequency = trackRollbackFrequency(signals);
  const timeToGreen = calculateTimeToGreen(signals);
  
  // Check for significant drift (any drift signal with count >= threshold)
  const hasSignificantDrift = recurringFailures.some(
    r => r.category === 'drift' && r.triggersDiagnosis
  );
  
  return {
    recurringFailures,
    skillCoverage,
    rollbackFrequency,
    timeToGreen,
    hasSignificantDrift,
  };
}
