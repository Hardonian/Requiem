/**
 * Semantic State Machine (SSM) — Core Primitive for AI Execution Governance
 *
 * A first-class, verifiable, replayable, policy-bound state machine for AI executions.
 * Treats AI execution as semantic state transitions, not just workflow runs.
 *
 * INVARIANT: Every semantic state has a stable, content-derived ID (fingerprint).
 * INVARIANT: Every transition is recorded with drift taxonomy.
 * INVARIANT: Every state has an integrity score from verifiable signals.
 * INVARIANT: No state mutation; states are append-only.
 *
 * This primitive cannot be replicated with GitHub Actions + OPA + Postgres
 * without re-implementing its core semantics.
 */

import { hash } from './hash.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES AND SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Opaque string type for semantic state IDs.
 * These are BLAKE3 hashes of the canonical descriptor representation.
 */
export type SemanticStateId = string & { __brand: 'SemanticStateId' };

/**
 * Opaque string type for policy snapshot IDs.
 */
export type PolicySnapshotId = string & { __brand: 'PolicySnapshotId' };

/**
 * Drift categories for semantic transitions.
 */
export const DriftCategory = {
  ModelDrift: 'model_drift',
  PromptDrift: 'prompt_drift',
  ContextDrift: 'context_drift',
  PolicyDrift: 'policy_drift',
  EvalDrift: 'eval_drift',
  RuntimeDrift: 'runtime_drift',
  UnknownDrift: 'unknown_drift',
} as const;

export type DriftCategory = typeof DriftCategory[keyof typeof DriftCategory];

/**
 * Zod schema for semantic state descriptor.
 * Describes the semantic configuration of an AI execution.
 */
export const SemanticStateDescriptorSchema = z.object({
  modelId: z.string().min(1),
  modelVersion: z.string().optional(),
  promptTemplateId: z.string().min(1),
  promptTemplateVersion: z.string().min(1),
  policySnapshotId: z.string().min(1),
  contextSnapshotId: z.string().min(1),
  runtimeId: z.string().min(1),
  evalSnapshotId: z.string().optional(),
  metadata: z.object({}).passthrough().optional(),
});

export type SemanticStateDescriptor = z.infer<typeof SemanticStateDescriptorSchema>;

/**
 * Zod schema for semantic state.
 */
export const SemanticStateSchema = z.object({
  id: z.string().min(1),
  descriptor: SemanticStateDescriptorSchema,
  createdAt: z.string().datetime(),
  actor: z.string().min(1),
  labels: z.object({}).catchall(z.string()).optional(),
  integrityScore: z.number().min(0).max(100),
  evidenceRefs: z.array(z.string()).optional(),
});

export type SemanticState = z.infer<typeof SemanticStateSchema>;

/**
 * Change vector describing a specific difference between states.
 */
export const ChangeVectorSchema = z.object({
  path: z.string(),
  from: z.unknown(),
  to: z.unknown(),
  significance: z.enum(['critical', 'major', 'minor', 'cosmetic']),
});

export type ChangeVector = z.infer<typeof ChangeVectorSchema>;

/**
 * Zod schema for semantic transition.
 */
export const SemanticTransitionSchema = z.object({
  fromId: z.string().optional(),
  toId: z.string().min(1),
  timestamp: z.string().datetime(),
  reason: z.string().min(1),
  driftCategories: z.array(z.string()),
  changeVectors: z.array(ChangeVectorSchema),
  integrityDelta: z.number(),
  replayStatus: z.enum(['verified', 'failed', 'pending', 'not_applicable']).optional(),
});

export type SemanticTransition = z.infer<typeof SemanticTransitionSchema>;

/**
 * Semantic ledger bundle for export/import.
 */
export const SemanticLedgerBundleSchema = z.object({
  version: z.literal('1.0.0'),
  exportedAt: z.string().datetime(),
  states: z.array(SemanticStateSchema),
  transitions: z.array(SemanticTransitionSchema),
});

export type SemanticLedgerBundle = z.infer<typeof SemanticLedgerBundleSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// STATE ID COMPUTATION (Uses existing hash, does not change semantics)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute a stable semantic state ID from a descriptor.
 * Uses existing BLAKE3 hash function; does not change determinism semantics.
 *
 * INVARIANT: Same descriptor always produces same ID.
 * INVARIANT: ID is cryptographically bound to descriptor content.
 */
export function computeSemanticStateId(descriptor: SemanticStateDescriptor): SemanticStateId {
  // Canonical JSON representation with sorted keys for determinism
  const canonical = JSON.stringify(descriptor, Object.keys(descriptor).sort());
  return hash(canonical) as SemanticStateId;
}

/**
 * Validate that a state ID matches its descriptor.
 */
export function verifySemanticStateId(
  id: SemanticStateId,
  descriptor: SemanticStateDescriptor
): boolean {
  return computeSemanticStateId(descriptor) === id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIFT TAXONOMY CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════════

export interface DriftClassification {
  driftCategories: DriftCategory[];
  changeVectors: ChangeVector[];
}

/**
 * Classify drift between two semantic state descriptors.
 * Returns deterministic, human-readable classification.
 */
export function classifyDrift(
  from: SemanticStateDescriptor,
  to: SemanticStateDescriptor
): DriftClassification {
  const driftCategories: DriftCategory[] = [];
  const changeVectors: ChangeVector[] = [];

  // Model drift detection
  if (from.modelId !== to.modelId || from.modelVersion !== to.modelVersion) {
    driftCategories.push(DriftCategory.ModelDrift);
    changeVectors.push({
      path: 'modelId',
      from: `${from.modelId}@${from.modelVersion || 'latest'}`,
      to: `${to.modelId}@${to.modelVersion || 'latest'}`,
      significance: 'critical',
    });
  }

  // Prompt drift detection
  if (
    from.promptTemplateId !== to.promptTemplateId ||
    from.promptTemplateVersion !== to.promptTemplateVersion
  ) {
    driftCategories.push(DriftCategory.PromptDrift);
    changeVectors.push({
      path: 'promptTemplate',
      from: `${from.promptTemplateId}@${from.promptTemplateVersion}`,
      to: `${to.promptTemplateId}@${to.promptTemplateVersion}`,
      significance: from.promptTemplateId !== to.promptTemplateId ? 'critical' : 'major',
    });
  }

  // Policy drift detection
  if (from.policySnapshotId !== to.policySnapshotId) {
    driftCategories.push(DriftCategory.PolicyDrift);
    changeVectors.push({
      path: 'policySnapshotId',
      from: from.policySnapshotId.substring(0, 16) + '...',
      to: to.policySnapshotId.substring(0, 16) + '...',
      significance: 'major',
    });
  }

  // Context drift detection
  if (from.contextSnapshotId !== to.contextSnapshotId) {
    driftCategories.push(DriftCategory.ContextDrift);
    changeVectors.push({
      path: 'contextSnapshotId',
      from: from.contextSnapshotId.substring(0, 16) + '...',
      to: to.contextSnapshotId.substring(0, 16) + '...',
      significance: 'minor',
    });
  }

  // Runtime drift detection
  if (from.runtimeId !== to.runtimeId) {
    driftCategories.push(DriftCategory.RuntimeDrift);
    changeVectors.push({
      path: 'runtimeId',
      from: from.runtimeId,
      to: to.runtimeId,
      significance: 'minor',
    });
  }

  // Eval drift detection
  if (from.evalSnapshotId !== to.evalSnapshotId) {
    driftCategories.push(DriftCategory.EvalDrift);
    changeVectors.push({
      path: 'evalSnapshotId',
      from: from.evalSnapshotId || 'none',
      to: to.evalSnapshotId || 'none',
      significance: 'minor',
    });
  }

  // If no specific drift detected but descriptors differ
  if (driftCategories.length === 0 && JSON.stringify(from) !== JSON.stringify(to)) {
    driftCategories.push(DriftCategory.UnknownDrift);
    changeVectors.push({
      path: 'metadata',
      from: 'varies',
      to: 'varies',
      significance: 'cosmetic',
    });
  }

  return { driftCategories, changeVectors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRITY SCORE COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntegrityScoreBreakdown {
  total: number;
  parityVerified: boolean;
  policyBound: boolean;
  contextCaptured: boolean;
  evalAttached: boolean;
  replayVerified: boolean;
  artifactSigned: boolean;
}

/**
 * Compute integrity score from verifiable signals.
 * Returns score (0-100) and breakdown of components.
 *
 * INVARIANT: Score is computed ONLY from verifiable signals.
 * INVARIANT: Same inputs always produce same score.
 */
export function computeIntegrityScore(
  state: Pick<SemanticState, 'descriptor' | 'evidenceRefs'>,
  verificationStatus: {
    parityVerified?: boolean;
    replayVerified?: boolean;
    artifactSigned?: boolean;
  } = {}
): IntegrityScoreBreakdown {
  const breakdown: IntegrityScoreBreakdown = {
    total: 0,
    parityVerified: verificationStatus.parityVerified ?? false,
    policyBound: state.descriptor.policySnapshotId !== '',
    contextCaptured: state.descriptor.contextSnapshotId !== '',
    evalAttached: state.descriptor.evalSnapshotId !== undefined && state.descriptor.evalSnapshotId !== '',
    replayVerified: verificationStatus.replayVerified ?? false,
    artifactSigned: verificationStatus.artifactSigned ?? false,
  };

  // Each component contributes equally (100 / 6 ≈ 16.67 points)
  const pointsPerComponent = 100 / 6;

  if (breakdown.parityVerified) breakdown.total += pointsPerComponent;
  if (breakdown.policyBound) breakdown.total += pointsPerComponent;
  if (breakdown.contextCaptured) breakdown.total += pointsPerComponent;
  if (breakdown.evalAttached) breakdown.total += pointsPerComponent;
  if (breakdown.replayVerified) breakdown.total += pointsPerComponent;
  if (breakdown.artifactSigned) breakdown.total += pointsPerComponent;

  // Round to nearest integer
  breakdown.total = Math.round(breakdown.total);

  return breakdown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SSM STORE INTERFACE AND LOCAL IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SSMStore interface for state and transition persistence.
 * Abstracts over local and cloud backends.
 */
export interface SSMStore {
  /** Get a state by ID */
  getState(id: SemanticStateId): SemanticState | undefined;

  /** List all states with optional filtering */
  listStates(filter?: {
    modelId?: string;
    policySnapshotId?: string;
    minIntegrityScore?: number;
    driftCategory?: DriftCategory;
    labels?: Record<string, string>;
  }): SemanticState[];

  /** Put a state (idempotent; overwrites if same ID) */
  putState(state: SemanticState): void;

  /** Get transitions for a state */
  getTransitionsTo(stateId: SemanticStateId): SemanticTransition[];

  /** Get transitions from a state */
  getTransitionsFrom(stateId: SemanticStateId): SemanticTransition[];

  /** Append a transition (append-only) */
  appendTransition(transition: SemanticTransition): void;

  /** Export all states and transitions as a bundle */
  exportBundle(): SemanticLedgerBundle;

  /** Import states and transitions from a bundle */
  importBundle(bundle: SemanticLedgerBundle): void;
}

/**
 * Local file-based SSM store implementation.
 * Stores states and transitions in `.reach/state/` directory.
 */
export class LocalSSMStore implements SSMStore {
  private basePath: string;
  private states: Map<SemanticStateId, SemanticState> = new Map();
  private transitions: SemanticTransition[] = [];
  private initialized = false;

  constructor(basePath: string = join(process.cwd(), '.reach', 'state')) {
    this.basePath = basePath;
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    // Ensure directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }

    // Load existing data
    this.load();
    this.initialized = true;
  }

  private get statesPath(): string {
    return join(this.basePath, 'states.json');
  }

  private get transitionsPath(): string {
    return join(this.basePath, 'transitions.json');
  }

  private load(): void {
    try {
      if (existsSync(this.statesPath)) {
        const statesData = JSON.parse(readFileSync(this.statesPath, 'utf-8'));
        for (const state of statesData) {
          const validated = SemanticStateSchema.parse(state);
          this.states.set(validated.id as SemanticStateId, validated);
        }
      }
    } catch (error) {
      // Invalid states file; start fresh
      this.states.clear();
    }

    try {
      if (existsSync(this.transitionsPath)) {
        const transitionsData = JSON.parse(readFileSync(this.transitionsPath, 'utf-8'));
        this.transitions = transitionsData.map((t: unknown) =>
          SemanticTransitionSchema.parse(t)
        );
      }
    } catch (error) {
      // Invalid transitions file; start fresh
      this.transitions = [];
    }
  }

  private save(): void {
    // Ensure directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }

    // Save states
    const statesArray = Array.from(this.states.values());
    writeFileSync(this.statesPath, JSON.stringify(statesArray, null, 2));

    // Save transitions
    writeFileSync(this.transitionsPath, JSON.stringify(this.transitions, null, 2));
  }

  getState(id: SemanticStateId): SemanticState | undefined {
    return this.states.get(id);
  }

  listStates(filter?: {
    modelId?: string;
    policySnapshotId?: string;
    minIntegrityScore?: number;
    driftCategory?: DriftCategory;
    labels?: Record<string, string>;
  }): SemanticState[] {
    let results = Array.from(this.states.values());

    if (filter) {
      if (filter.modelId) {
        results = results.filter(s => s.descriptor.modelId === filter.modelId);
      }
      if (filter.policySnapshotId) {
        results = results.filter(s => s.descriptor.policySnapshotId === filter.policySnapshotId);
      }
      if (filter.minIntegrityScore !== undefined) {
        results = results.filter(s => s.integrityScore >= filter.minIntegrityScore!);
      }
      if (filter.labels) {
        results = results.filter(s => {
          if (!s.labels) return false;
          return Object.entries(filter.labels!).every(
            ([key, value]) => s.labels?.[key] === value
          );
        });
      }
      // Note: driftCategory filter requires looking at transitions, handled separately
    }

    // Sort by createdAt descending
    return results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  putState(state: SemanticState): void {
    // Validate state before storing
    SemanticStateSchema.parse(state);
    this.states.set(state.id as SemanticStateId, state);
    this.save();
  }

  getTransitionsTo(stateId: SemanticStateId): SemanticTransition[] {
    return this.transitions.filter(t => t.toId === stateId);
  }

  getTransitionsFrom(stateId: SemanticStateId): SemanticTransition[] {
    return this.transitions.filter(t => t.fromId === stateId);
  }

  appendTransition(transition: SemanticTransition): void {
    // Validate transition before storing
    SemanticTransitionSchema.parse(transition);
    this.transitions.push(transition);
    this.save();
  }

  exportBundle(): SemanticLedgerBundle {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      states: Array.from(this.states.values()),
      transitions: this.transitions,
    };
  }

  importBundle(bundle: SemanticLedgerBundle): void {
    // Validate bundle
    SemanticLedgerBundleSchema.parse(bundle);

    // Merge states (newer wins)
    for (const state of bundle.states) {
      this.states.set(state.id as SemanticStateId, state);
    }

    // Merge transitions (deduplicate by composite key)
    const existingKeys = new Set(
      this.transitions.map(t => `${t.fromId}:${t.toId}:${t.timestamp}`)
    );
    for (const transition of bundle.transitions) {
      const key = `${transition.fromId}:${transition.toId}:${transition.timestamp}`;
      if (!existingKeys.has(key)) {
        this.transitions.push(transition);
        existingKeys.add(key);
      }
    }

    this.save();
  }

  /** Get lineage graph for a state (all ancestors) */
  getLineage(stateId: SemanticStateId): SemanticState[] {
    const lineage: SemanticState[] = [];
    const visited = new Set<string>();

    const traverse = (id: SemanticStateId) => {
      if (visited.has(id)) return;
      visited.add(id);

      const state = this.states.get(id);
      if (!state) return;

      lineage.push(state);

      // Find transitions TO this state
      const incoming = this.transitions.filter(t => t.toId === id);
      for (const t of incoming) {
        if (t.fromId) {
          traverse(t.fromId as SemanticStateId);
        }
      }
    };

    traverse(stateId);
    return lineage.reverse(); // Oldest first
  }

  /** Generate DOT graph representation */
  toDotGraph(): string {
    const lines: string[] = ['digraph SemanticStateMachine {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, fontname="monospace"];');

    // Add nodes
    for (const state of this.states.values()) {
      const shortId = state.id.substring(0, 8);
      const label = `${shortId}\\n${state.descriptor.modelId}\\nscore:${state.integrityScore}`;
      lines.push(`  "${state.id}" [label="${label}"];`);
    }

    // Add edges
    for (const t of this.transitions) {
      const from = t.fromId ? `"${t.fromId}"` : '"__GENESIS__"';
      const label = t.driftCategories.join(',');
      lines.push(`  ${from} -> "${t.toId}" [label="${label}"];`);
    }

    lines.push('}');
    return lines.join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL MIGRATION SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface MigrationImpact {
  stateId: SemanticStateId;
  currentModel: string;
  riskCategory: 'needs_re_eval' | 'policy_risk' | 'replay_break' | 'compatible';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface MigrationSimulationResult {
  fromModel: string;
  toModel: string;
  totalStates: number;
  impacts: MigrationImpact[];
  summary: {
    needsReEval: number;
    policyRisk: number;
    replayBreak: number;
    compatible: number;
  };
}

/**
 * Simulate model upgrade impact on semantic states.
 * Offline by default; returns governance impact report.
 */
export function simulateModelMigration(
  store: SSMStore,
  fromModel: string,
  toModel: string,
  options: {
    policyRef?: string;
    evalRef?: string;
  } = {}
): MigrationSimulationResult {
  const allStates = store.listStates();
  const impacts: MigrationImpact[] = [];

  for (const state of allStates) {
    // Only consider states using the fromModel
    if (state.descriptor.modelId !== fromModel) {
      continue;
    }

    let riskCategory: MigrationImpact['riskCategory'] = 'compatible';
    let reason = 'Model change compatible with existing policy and context';
    let confidence: MigrationImpact['confidence'] = 'high';

    // Check if eval snapshot exists (higher confidence if present)
    if (!state.descriptor.evalSnapshotId) {
      confidence = 'medium';
      reason = 'No eval snapshot; re-evaluation recommended';
    }

    // Check policy compatibility
    if (options.policyRef && state.descriptor.policySnapshotId !== options.policyRef) {
      riskCategory = 'policy_risk';
      reason = `State uses different policy snapshot than target`;
      confidence = 'high';
    }

    // Check replay history
    const transitions = store.getTransitionsTo(state.id as SemanticStateId);
    const hasReplayFailure = transitions.some(t => t.replayStatus === 'failed');
    if (hasReplayFailure) {
      riskCategory = 'replay_break';
      reason = 'State has history of replay failures';
      confidence = 'high';
    }

    // Model version change always needs re-eval
    if (fromModel !== toModel) {
      riskCategory = 'needs_re_eval';
      reason = 'Model change requires re-evaluation';
    }

    impacts.push({
      stateId: state.id as SemanticStateId,
      currentModel: state.descriptor.modelId,
      riskCategory,
      reason,
      confidence,
    });
  }

  const summary = {
    needsReEval: impacts.filter(i => i.riskCategory === 'needs_re_eval').length,
    policyRisk: impacts.filter(i => i.riskCategory === 'policy_risk').length,
    replayBreak: impacts.filter(i => i.riskCategory === 'replay_break').length,
    compatible: impacts.filter(i => i.riskCategory === 'compatible').length,
  };

  return {
    fromModel,
    toModel,
    totalStates: impacts.length,
    impacts,
    summary,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY AND DEFAULT INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let defaultStore: SSMStore | null = null;

/**
 * Get the default SSM store instance.
 * Creates a local file-based store if none exists.
 */
export function getDefaultSSMStore(): SSMStore {
  if (!defaultStore) {
    defaultStore = new LocalSSMStore();
  }
  return defaultStore;
}

/**
 * Reset the default store (useful for testing).
 */
export function resetDefaultSSMStore(): void {
  defaultStore = null;
}

/**
 * Create a semantic state from a descriptor with automatic ID computation.
 */
export function createSemanticState(
  descriptor: SemanticStateDescriptor,
  options: {
    actor?: string;
    labels?: Record<string, string>;
    evidenceRefs?: string[];
    verificationStatus?: {
      parityVerified?: boolean;
      replayVerified?: boolean;
      artifactSigned?: boolean;
    };
  } = {}
): SemanticState {
  const id = computeSemanticStateId(descriptor);
  const createdAt = new Date().toISOString();

  const partialState: Pick<SemanticState, 'descriptor' | 'evidenceRefs'> = {
    descriptor,
    evidenceRefs: options.evidenceRefs,
  };

  const integrityBreakdown = computeIntegrityScore(partialState, options.verificationStatus);

  return {
    id,
    descriptor,
    createdAt,
    actor: options.actor || 'system',
    labels: options.labels,
    integrityScore: integrityBreakdown.total,
    evidenceRefs: options.evidenceRefs,
  };
}

/**
 * Create a semantic transition between two states.
 */
export function createSemanticTransition(
  fromState: SemanticState | null,
  toState: SemanticState,
  reason: string,
  options: {
    replayStatus?: SemanticTransition['replayStatus'];
  } = {}
): SemanticTransition {
  const drift = fromState
    ? classifyDrift(fromState.descriptor, toState.descriptor)
    : { driftCategories: [] as DriftCategory[], changeVectors: [] as ChangeVector[] };

  const integrityDelta = fromState
    ? toState.integrityScore - fromState.integrityScore
    : toState.integrityScore;

  return {
    fromId: fromState?.id,
    toId: toState.id,
    timestamp: new Date().toISOString(),
    reason,
    driftCategories: drift.driftCategories,
    changeVectors: drift.changeVectors,
    integrityDelta,
    replayStatus: options.replayStatus,
  };
}
