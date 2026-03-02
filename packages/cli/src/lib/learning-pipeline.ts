/**
 * Learning Pipeline
 * 
 * Deterministic pipeline: signals → diagnoses → patch proposals
 * 
 * - Signals are captured during runtime execution
 * - Diagnoses map signals to root causes with confidence scores
 * - Patch proposals are generated from diagnoses
 * 
 * All outputs are artifacts only - never auto-applied.
 */

import {
  LearningSignalRepository,
  LearningDiagnosisRepository,
  LearningPatchRepository,
  SkillRepository,
  type SignalCategory,
  type RootCause,
  type PatchType,
  type LearningSignal,
  type LearningDiagnosis,
  type LearningPatch,
} from '../db/governance.js';
import {
  analyzeSignals,
  determineRootCause,
  calculateConfidenceScore,
} from './drift-detector.js';

// ─── Signal Threshold ─────────────────────────────────────────────────────────

const SIGNAL_THRESHOLD = 1; // Minimum signals to trigger diagnosis

// ─── Root Cause Mapper ─────────────────────────────────────────────────────────

const ROOT_CAUSE_MAPPER: Record<SignalCategory, RootCause> = {
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

// ─── Patch Type Proposer ───────────────────────────────────────────────────────

const PATCH_TYPE_PROPOSER: Record<RootCause, PatchType> = {
  prompt_gap: 'prompt_update',
  skill_gap: 'skill_update',
  schema_gap: 'schema_update',
  config_gap: 'config_update',
  policy_gap: 'config_update',
  strategic_misalignment: 'branch_plan',
  economic_misalignment: 'cost_model_update',
};

// ─── Target File Mapper ────────────────────────────────────────────────────────

const ROOT_CAUSE_TARGET_FILES: Record<RootCause, string[]> = {
  prompt_gap: ['prompts/templates/'],
  skill_gap: ['skills/'],
  schema_gap: ['artifacts/schemas/'],
  config_gap: ['.env.example', 'verify-config.ts'],
  policy_gap: ['contracts/'],
  strategic_misalignment: ['docs/architecture/'],
  economic_misalignment: ['contracts/cost-model.json'],
};

// ─── Signal Capture ───────────────────────────────────────────────────────────

export interface CaptureSignalParams {
  tenantId: string;
  runId?: string;
  category: SignalCategory;
  metadata?: Record<string, unknown>;
}

/**
 * Capture a learning signal from runtime execution.
 * This is called when a signal is detected during execution.
 */
export function captureSignal(params: CaptureSignalParams): LearningSignal {
  return LearningSignalRepository.create({
    tenantId: params.tenantId,
    runId: params.runId,
    category: params.category,
    metadata: params.metadata,
  });
}

// ─── Diagnosis Generation ─────────────────────────────────────────────────────

export interface DiagnoseParams {
  tenantId: string;
  since?: Date;
}

/**
 * Generate diagnoses from accumulated signals.
 * Deterministic: same signals always produce same diagnosis.
 */
export function diagnose(params: DiagnoseParams): LearningDiagnosis[] {
  const signals = LearningSignalRepository.findAllByTenant(
    params.tenantId,
    params.since
  );
  
  if (signals.length === 0) {
    return [];
  }
  
  // Group signals by category
  const categoryGroups = new Map<SignalCategory, LearningSignal[]>();
  for (const signal of signals) {
    const group = categoryGroups.get(signal.category) || [];
    group.push(signal);
    categoryGroups.set(signal.category, group);
  }
  
  const diagnoses: LearningDiagnosis[] = [];
  
  // Generate diagnosis for each category that exceeds threshold
  for (const [category, categorySignals] of categoryGroups) {
    if (categorySignals.length >= SIGNAL_THRESHOLD) {
      const rootCause = ROOT_CAUSE_MAPPER[category];
      const confidenceScore = calculateConfidenceScore(categorySignals.length);
      const signalIds = categorySignals.map(s => s.id);
      
      const diagnosis = LearningDiagnosisRepository.create({
        tenantId: params.tenantId,
        signalIds,
        rootCause,
        confidenceScore,
      });
      
      diagnoses.push(diagnosis);
    }
  }
  
  return diagnoses;
}

// ─── Patch Proposal Generation ───────────────────────────────────────────────

export interface GeneratePatchParams {
  tenantId: string;
  diagnosisId: string;
  patchDiff?: Record<string, unknown>;
  rollbackPlan?: Record<string, unknown>;
}

/**
 * Generate a patch proposal from a diagnosis.
 * All patches include rollback instructions.
 */
export function generatePatch(params: GeneratePatchParams): LearningPatch | null {
  const diagnosis = LearningDiagnosisRepository.findById(params.diagnosisId);
  
  if (!diagnosis) {
    return null;
  }
  
  const patchType = PATCH_TYPE_PROPOSER[diagnosis.root_cause];
  const targetFiles = ROOT_CAUSE_TARGET_FILES[diagnosis.root_cause] || [];
  
  // Generate rollback plan if not provided
  const rollbackPlan = params.rollbackPlan || {
    action: 'revert',
    target: 'previous_state',
    verification: 'run full verify suite',
  };
  
  // Generate patch diff if not provided
  const patchDiff = params.patchDiff || {
    type: patchType,
    root_cause: diagnosis.root_cause,
    confidence: diagnosis.confidence_score,
    description: `Proposed fix for ${diagnosis.root_cause}`,
  };
  
  return LearningPatchRepository.create({
    tenantId: params.tenantId,
    diagnosisId: params.diagnosisId,
    patchType,
    targetFiles,
    patchDiff,
    rollbackPlan,
  });
}

// ─── Full Pipeline ───────────────────────────────────────────────────────────

export interface RunPipelineParams {
  tenantId: string;
  since?: Date;
  autoGeneratePatches?: boolean;
}

export interface PipelineResult {
  signals: LearningSignal[];
  diagnoses: LearningDiagnosis[];
  patches: LearningPatch[];
}

/**
 * Run the full learning pipeline: signals → diagnoses → patches.
 */
export function runLearningPipeline(
  params: RunPipelineParams
): PipelineResult {
  // Step 1: Get existing signals
  const signals = LearningSignalRepository.findAllByTenant(
    params.tenantId,
    params.since
  );
  
  // Step 2: Generate diagnoses from signals
  const diagnoses = diagnose({
    tenantId: params.tenantId,
    since: params.since,
  });
  
  // Step 3: Generate patch proposals from diagnoses
  const patches: LearningPatch[] = [];
  
  if (params.autoGeneratePatches !== false) {
    for (const diagnosis of diagnoses) {
      const patch = generatePatch({
        tenantId: params.tenantId,
        diagnosisId: diagnosis.id,
      });
      
      if (patch) {
        patches.push(patch);
      }
    }
  }
  
  return {
    signals,
    diagnoses,
    patches,
  };
}

// ─── Get Learning Summary ─────────────────────────────────────────────────────

export interface LearningSummaryParams {
  tenantId: string;
  since?: Date;
}

export interface LearningSummary {
  signalCounts: Record<SignalCategory, number>;
  diagnosisCount: number;
  patchCount: number;
  proposedPatches: LearningPatch[];
  appliedPatches: LearningPatch[];
  rejectedPatches: LearningPatch[];
}

/**
 * Get a summary of learning data for a tenant.
 */
export function getLearningSummary(params: LearningSummaryParams): LearningSummary {
  const signals = LearningSignalRepository.findAllByTenant(
    params.tenantId,
    params.since
  );
  
  const signalCounts: Partial<Record<SignalCategory, number>> = {};
  for (const signal of signals) {
    signalCounts[signal.category] = (signalCounts[signal.category] || 0) + 1;
  }
  
  const diagnoses = LearningDiagnosisRepository.findByTenant(
    params.tenantId,
    params.since
  );
  
  const patches = LearningPatchRepository.findByTenant(params.tenantId);
  
  return {
    signalCounts: signalCounts as Record<SignalCategory, number>,
    diagnosisCount: diagnoses.length,
    patchCount: patches.length,
    proposedPatches: patches.filter(p => p.status === 'proposed'),
    appliedPatches: patches.filter(p => p.status === 'applied'),
    rejectedPatches: patches.filter(p => p.status === 'rejected'),
  };
}

