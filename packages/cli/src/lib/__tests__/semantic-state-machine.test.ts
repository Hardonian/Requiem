/**
 * @fileoverview Tests for the Semantic State Machine primitive.
 *
 * INVARIANT: All tests are deterministic (no randomness, no network).
 * INVARIANT: Tests verify both success and failure paths.
 * INVARIANT: Schema validation is tested for all public types.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  // Types
  type SemanticStateDescriptor,
  type SemanticState,
  type SemanticTransition,
  DriftCategory,

  // ID computation
  computeSemanticStateId,
  verifySemanticStateId,

  // Drift classification
  classifyDrift,

  // Integrity score
  computeIntegrityScore,

  // Store
  LocalSSMStore,
  type SSMStore,

  // Migration simulation
  simulateModelMigration,

  // Factory functions
  createSemanticState,
  createSemanticTransition,

  // Constants
  SemanticStateDescriptorSchema,
  SemanticStateSchema,
  SemanticTransitionSchema,
  SemanticLedgerBundleSchema,
} from '../semantic-state-machine.js';

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

const createTestDescriptor = (overrides: Partial<SemanticStateDescriptor> = {}): SemanticStateDescriptor => ({
  modelId: 'gpt-4',
  modelVersion: '2024-01',
  promptTemplateId: 'test-template',
  promptTemplateVersion: '1.0.0',
  policySnapshotId: 'abc123def4567890abcdef1234567890abcdef12',
  contextSnapshotId: 'context7890abcdef1234567890abcdef1234567890abcdef12',
  runtimeId: 'node-20',
  ...overrides,
});

/**
 * Generate a valid 64-character hex state ID for testing.
 * In production, these are BLAKE3 hashes of descriptors.
 */
const testId = (seed: string): string => {
  // Create a deterministic 64-char hex string from seed
  const hexChars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += hexChars[(seed.charCodeAt(i % seed.length) + i) % 16];
  }
  return result;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Schema Validation', () => {
  describe('SemanticStateDescriptorSchema', () => {
    it('should validate a valid descriptor', () => {
      const descriptor = createTestDescriptor();
      expect(() => SemanticStateDescriptorSchema.parse(descriptor)).not.toThrow();
    });

    it('should reject descriptor without required fields', () => {
      const invalid = { modelId: 'gpt-4' };
      expect(() => SemanticStateDescriptorSchema.parse(invalid)).toThrow();
    });

    it('should reject empty strings', () => {
      const invalid = createTestDescriptor({ modelId: '' });
      expect(() => SemanticStateDescriptorSchema.parse(invalid)).toThrow();
    });

    it('should accept optional evalSnapshotId', () => {
      const descriptor = createTestDescriptor({ evalSnapshotId: 'eval-123' });
      const parsed = SemanticStateDescriptorSchema.parse(descriptor);
      expect(parsed.evalSnapshotId).toBe('eval-123');
    });

    it('should accept metadata', () => {
      const descriptor = createTestDescriptor({
        metadata: { temperature: 0.7, maxTokens: 1000 },
      });
      const parsed = SemanticStateDescriptorSchema.parse(descriptor);
      expect(parsed.metadata).toEqual({ temperature: 0.7, maxTokens: 1000 });
    });
  });

  describe('SemanticStateSchema', () => {
    it('should validate a valid state', () => {
      const state: SemanticState = {
        id: 'state123',
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test-user',
        integrityScore: 83,
      };
      expect(() => SemanticStateSchema.parse(state)).not.toThrow();
    });

    it('should reject invalid integrity score', () => {
      const state = {
        id: 'state123',
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test-user',
        integrityScore: 150, // Invalid: > 100
      };
      expect(() => SemanticStateSchema.parse(state)).toThrow();
    });

    it('should reject invalid datetime', () => {
      const state = {
        id: 'state123',
        descriptor: createTestDescriptor(),
        createdAt: 'not-a-datetime',
        actor: 'test-user',
        integrityScore: 50,
      };
      expect(() => SemanticStateSchema.parse(state)).toThrow();
    });
  });

  describe('SemanticTransitionSchema', () => {
    it('should validate a valid transition', () => {
      const transition: SemanticTransition = {
        fromId: 'state1',
        toId: 'state2',
        timestamp: '2024-01-15T10:00:00Z',
        reason: 'Model upgrade',
        driftCategories: [DriftCategory.ModelDrift],
        changeVectors: [{
          path: 'modelId',
          from: 'gpt-4',
          to: 'gpt-4-turbo',
          significance: 'critical',
        }],
        integrityDelta: 0,
      };
      expect(() => SemanticTransitionSchema.parse(transition)).not.toThrow();
    });

    it('should allow genesis transition (no fromId)', () => {
      const transition: SemanticTransition = {
        toId: 'state2',
        timestamp: '2024-01-15T10:00:00Z',
        reason: 'Initial state',
        driftCategories: [],
        changeVectors: [],
        integrityDelta: 83,
      };
      expect(() => SemanticTransitionSchema.parse(transition)).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATE ID COMPUTATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('State ID Computation', () => {
  it('should produce stable IDs for same descriptor', () => {
    const descriptor = createTestDescriptor();
    const id1 = computeSemanticStateId(descriptor);
    const id2 = computeSemanticStateId(descriptor);
    expect(id1).toBe(id2);
  });

  it('should produce different IDs for different descriptors', () => {
    const descriptor1 = createTestDescriptor();
    const descriptor2 = createTestDescriptor({ modelId: 'claude-3' });
    const id1 = computeSemanticStateId(descriptor1);
    const id2 = computeSemanticStateId(descriptor2);
    expect(id1).not.toBe(id2);
  });

  it('should produce valid hex hash', () => {
    const descriptor = createTestDescriptor();
    const id = computeSemanticStateId(descriptor);
    expect(id).toMatch(/^[a-f0-9]{64}$/); // BLAKE3 produces 64-char hex
  });

  it('should verify matching ID and descriptor', () => {
    const descriptor = createTestDescriptor();
    const id = computeSemanticStateId(descriptor);
    expect(verifySemanticStateId(id, descriptor)).toBe(true);
  });

  it('should reject non-matching ID and descriptor', () => {
    const descriptor1 = createTestDescriptor();
    const descriptor2 = createTestDescriptor({ modelId: 'different' });
    const id = computeSemanticStateId(descriptor1);
    expect(verifySemanticStateId(id, descriptor2)).toBe(false);
  });

  it('should be deterministic across key ordering', () => {
    const descriptor1 = createTestDescriptor();
    // Manually create descriptor with different key order but same values
    const descriptor2: SemanticStateDescriptor = {
      runtimeId: 'node-20',
      contextSnapshotId: 'context7890abcdef1234567890abcdef1234567890abcdef12',
      policySnapshotId: 'abc123def4567890abcdef1234567890abcdef12',
      promptTemplateVersion: '1.0.0',
      promptTemplateId: 'test-template',
      modelVersion: '2024-01',
      modelId: 'gpt-4',
    };
    const id1 = computeSemanticStateId(descriptor1);
    const id2 = computeSemanticStateId(descriptor2);
    expect(id1).toBe(id2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DRIFT CLASSIFICATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Drift Classification', () => {
  it('should detect model drift', () => {
    const from = createTestDescriptor({ modelId: 'gpt-4' });
    const to = createTestDescriptor({ modelId: 'claude-3' });
    const drift = classifyDrift(from, to);

    expect(drift.driftCategories).toContain(DriftCategory.ModelDrift);
    expect(drift.changeVectors).toHaveLength(1);
    expect(drift.changeVectors[0].path).toBe('modelId');
    expect(drift.changeVectors[0].significance).toBe('critical');
  });

  it('should detect prompt drift', () => {
    const from = createTestDescriptor({ promptTemplateId: 'template-v1' });
    const to = createTestDescriptor({ promptTemplateId: 'template-v2' });
    const drift = classifyDrift(from, to);

    expect(drift.driftCategories).toContain(DriftCategory.PromptDrift);
    expect(drift.changeVectors[0].significance).toBe('critical');
  });

  it('should detect policy drift', () => {
    const from = createTestDescriptor({ policySnapshotId: 'policy-v1' });
    const to = createTestDescriptor({ policySnapshotId: 'policy-v2' });
    const drift = classifyDrift(from, to);

    expect(drift.driftCategories).toContain(DriftCategory.PolicyDrift);
    expect(drift.changeVectors[0].significance).toBe('major');
  });

  it('should detect multiple drift categories', () => {
    const from = createTestDescriptor({
      modelId: 'gpt-4',
      promptTemplateId: 'template-v1',
      policySnapshotId: 'policy-v1',
    });
    const to = createTestDescriptor({
      modelId: 'claude-3',
      promptTemplateId: 'template-v2',
      policySnapshotId: 'policy-v2',
    });
    const drift = classifyDrift(from, to);

    expect(drift.driftCategories).toHaveLength(3);
    expect(drift.driftCategories).toContain(DriftCategory.ModelDrift);
    expect(drift.driftCategories).toContain(DriftCategory.PromptDrift);
    expect(drift.driftCategories).toContain(DriftCategory.PolicyDrift);
  });

  it('should return empty drift for identical descriptors', () => {
    const descriptor = createTestDescriptor();
    const drift = classifyDrift(descriptor, descriptor);

    expect(drift.driftCategories).toHaveLength(0);
    expect(drift.changeVectors).toHaveLength(0);
  });

  it('should detect runtime drift', () => {
    const from = createTestDescriptor({ runtimeId: 'node-18' });
    const to = createTestDescriptor({ runtimeId: 'node-20' });
    const drift = classifyDrift(from, to);

    expect(drift.driftCategories).toContain(DriftCategory.RuntimeDrift);
    expect(drift.changeVectors[0].significance).toBe('minor');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRITY SCORE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integrity Score Computation', () => {
  it('should compute perfect score when all signals verified', () => {
    const state = {
      descriptor: createTestDescriptor({ evalSnapshotId: 'eval-123' }),
    };
    const breakdown = computeIntegrityScore(state, {
      parityVerified: true,
      replayVerified: true,
      artifactSigned: true,
    });

    expect(breakdown.total).toBe(100);
    expect(breakdown.parityVerified).toBe(true);
    expect(breakdown.replayVerified).toBe(true);
    expect(breakdown.artifactSigned).toBe(true);
  });

  it('should compute zero score when no signals verified', () => {
    const state = {
      descriptor: createTestDescriptor({ evalSnapshotId: '' }),
    };
    const breakdown = computeIntegrityScore(state, {});

    // policyBound (descriptor.policySnapshotId !== '') = true
    // contextCaptured (descriptor.contextSnapshotId !== '') = true
    // evalAttached (evalSnapshotId is '', so false) = false
    // 2 out of 6 components = 33.33%, rounded to 33
    expect(breakdown.total).toBe(33);
    expect(breakdown.parityVerified).toBe(false);
    expect(breakdown.replayVerified).toBe(false);
    expect(breakdown.artifactSigned).toBe(false);
    expect(breakdown.policyBound).toBe(true);
    expect(breakdown.contextCaptured).toBe(true);
    expect(breakdown.evalAttached).toBe(false);
  });

  it('should reward eval attachment', () => {
    const stateWithEval = {
      descriptor: createTestDescriptor({ evalSnapshotId: 'eval-123' }),
    };
    const stateWithoutEval = {
      descriptor: createTestDescriptor({}),
    };

    const breakdownWith = computeIntegrityScore(stateWithEval, {});
    const breakdownWithout = computeIntegrityScore(stateWithoutEval, {});

    expect(breakdownWith.total).toBeGreaterThan(breakdownWithout.total);
    expect(breakdownWith.evalAttached).toBe(true);
    expect(breakdownWithout.evalAttached).toBe(false);
  });

  it('should be deterministic', () => {
    const state = {
      descriptor: createTestDescriptor(),
    };
    const breakdown1 = computeIntegrityScore(state, { parityVerified: true });
    const breakdown2 = computeIntegrityScore(state, { parityVerified: true });

    expect(breakdown1.total).toBe(breakdown2.total);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STORE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('LocalSSMStore', () => {
  let tempDir: string;
  let store: SSMStore;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ssm-test-'));
    store = new LocalSSMStore(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('State Operations', () => {
    it('should store and retrieve a state', () => {
      const stateId = testId('state-123');
      const state: SemanticState = {
        id: stateId,
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test',
        integrityScore: 83,
      };

      store.putState(state);
      const retrieved = store.getState(stateId);

      expect(retrieved).toEqual(state);
    });

    it('should return undefined for non-existent state', () => {
      const retrieved = store.getState(testId('non-existent'));
      expect(retrieved).toBeUndefined();
    });

    it('should list all states', () => {
      const state1: SemanticState = {
        id: testId('list-state-1'),
        descriptor: createTestDescriptor({ modelId: 'gpt-4' }),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test',
        integrityScore: 80,
      };
      const state2: SemanticState = {
        id: testId('list-state-2'),
        descriptor: createTestDescriptor({ modelId: 'claude-3' }),
        createdAt: '2024-01-15T11:00:00Z',
        actor: 'test',
        integrityScore: 90,
      };

      store.putState(state1);
      store.putState(state2);
      const listed = store.listStates();

      expect(listed).toHaveLength(2);
    });

    it('should filter states by modelId', () => {
      const state1: SemanticState = {
        id: testId('filter-model-1'),
        descriptor: createTestDescriptor({ modelId: 'gpt-4' }),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test',
        integrityScore: 80,
      };
      const state2: SemanticState = {
        id: testId('filter-model-2'),
        descriptor: createTestDescriptor({ modelId: 'claude-3' }),
        createdAt: '2024-01-15T11:00:00Z',
        actor: 'test',
        integrityScore: 90,
      };

      store.putState(state1);
      store.putState(state2);
      const listed = store.listStates({ modelId: 'gpt-4' });

      expect(listed).toHaveLength(1);
      expect(listed[0].descriptor.modelId).toBe('gpt-4');
    });

    it('should filter states by minIntegrityScore', () => {
      const state1: SemanticState = {
        id: testId('filter-score-1'),
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test',
        integrityScore: 50,
      };
      const state2: SemanticState = {
        id: testId('filter-score-2'),
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T11:00:00Z',
        actor: 'test',
        integrityScore: 90,
      };

      store.putState(state1);
      store.putState(state2);
      const listed = store.listStates({ minIntegrityScore: 75 });

      expect(listed).toHaveLength(1);
      expect(listed[0].integrityScore).toBe(90);
    });

    it('should filter states by labels', () => {
      const state1: SemanticState = {
        id: testId('filter-label-1'),
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test',
        integrityScore: 80,
        labels: { env: 'prod', team: 'platform' },
      };
      const state2: SemanticState = {
        id: testId('filter-label-2'),
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T11:00:00Z',
        actor: 'test',
        integrityScore: 90,
        labels: { env: 'dev', team: 'platform' },
      };

      store.putState(state1);
      store.putState(state2);
      const listed = store.listStates({ labels: { env: 'prod' } });

      expect(listed).toHaveLength(1);
      expect(listed[0].labels?.env).toBe('prod');
    });

    it('should sort states by createdAt descending', () => {
      const state1: SemanticState = {
        id: testId('sort-state-1'),
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test',
        integrityScore: 80,
      };
      const state2: SemanticState = {
        id: testId('sort-state-2'),
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T12:00:00Z',
        actor: 'test',
        integrityScore: 90,
      };

      store.putState(state1);
      store.putState(state2);
      const listed = store.listStates();

      expect(listed[0].id).toBe(testId('sort-state-2'));
      expect(listed[1].id).toBe(testId('sort-state-1'));
    });
  });

  describe('Transition Operations', () => {
    it('should append and retrieve transitions', () => {
      const fromId = testId('trans-from');
      const toId = testId('trans-to');
      const transition: SemanticTransition = {
        fromId,
        toId,
        timestamp: '2024-01-15T10:00:00Z',
        reason: 'Model upgrade',
        driftCategories: [DriftCategory.ModelDrift],
        changeVectors: [],
        integrityDelta: 0,
      };

      store.appendTransition(transition);
      const toTransitions = store.getTransitionsTo(toId);
      const fromTransitions = store.getTransitionsFrom(fromId);

      expect(toTransitions).toHaveLength(1);
      expect(fromTransitions).toHaveLength(1);
      expect(toTransitions[0]).toEqual(transition);
    });

    it('should handle genesis transitions (no fromId)', () => {
      const toId = testId('genesis-to');
      const transition: SemanticTransition = {
        toId,
        timestamp: '2024-01-15T10:00:00Z',
        reason: 'Initial state',
        driftCategories: [],
        changeVectors: [],
        integrityDelta: 83,
      };

      store.appendTransition(transition);
      const toTransitions = store.getTransitionsTo(toId);

      expect(toTransitions).toHaveLength(1);
      expect(toTransitions[0].fromId).toBeUndefined();
    });
  });

  describe('Bundle Operations', () => {
    it('should export and import bundle', () => {
      const stateId = testId('bundle-state');
      const state: SemanticState = {
        id: stateId,
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test',
        integrityScore: 83,
      };
      const transition: SemanticTransition = {
        toId: stateId,
        timestamp: '2024-01-15T10:00:00Z',
        reason: 'Initial',
        driftCategories: [],
        changeVectors: [],
        integrityDelta: 83,
      };

      store.putState(state);
      store.appendTransition(transition);

      const bundle = store.exportBundle();
      expect(bundle.version).toBe('1.0.0');
      expect(bundle.states).toHaveLength(1);
      expect(bundle.transitions).toHaveLength(1);

      // Create new store and import
      const newStore = new LocalSSMStore(join(tempDir, 'imported'));
      newStore.importBundle(bundle);

      expect(newStore.getState(stateId)).toEqual(state);
      expect(newStore.getTransitionsTo(stateId)).toHaveLength(1);
    });

    it('should validate bundle on import', () => {
      const invalidBundle = {
        version: '2.0.0', // Invalid version
        exportedAt: new Date().toISOString(),
        states: [],
        transitions: [],
      };

      expect(() => store.importBundle(invalidBundle as any)).toThrow();
    });
  });

  describe('Lineage', () => {
    it('should compute lineage', () => {
      const storeWithLineage = store as LocalSSMStore;
      const state1Id = testId('lineage-state-1');
      const state2Id = testId('lineage-state-2');

      const state1: SemanticState = {
        id: state1Id,
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test',
        integrityScore: 80,
      };
      const state2: SemanticState = {
        id: state2Id,
        descriptor: createTestDescriptor({ modelId: 'claude-3' }),
        createdAt: '2024-01-15T11:00:00Z',
        actor: 'test',
        integrityScore: 90,
      };

      store.putState(state1);
      store.putState(state2);

      const transition: SemanticTransition = {
        fromId: state1Id,
        toId: state2Id,
        timestamp: '2024-01-15T11:00:00Z',
        reason: 'Model upgrade',
        driftCategories: [DriftCategory.ModelDrift],
        changeVectors: [],
        integrityDelta: 10,
      };
      store.appendTransition(transition);

      const lineage = storeWithLineage.getLineage(state2Id);
      expect(lineage).toHaveLength(2);
      expect(lineage[0].id).toBe(state1Id);
      expect(lineage[1].id).toBe(state2Id);
    });

    it('should generate DOT graph', () => {
      const storeWithGraph = store as LocalSSMStore;
      const stateId = testId('dot-graph-state');

      const state1: SemanticState = {
        id: stateId,
        descriptor: createTestDescriptor(),
        createdAt: '2024-01-15T10:00:00Z',
        actor: 'test',
        integrityScore: 80,
      };

      store.putState(state1);

      const dot = storeWithGraph.toDotGraph();
      expect(dot).toContain('digraph SemanticStateMachine');
      expect(dot).toContain(stateId.substring(0, 8)); // Short ID in label
      expect(dot).toContain('gpt-4');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MIGRATION SIMULATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Model Migration Simulation', () => {
  let store: SSMStore;

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ssm-migration-test-'));
    store = new LocalSSMStore(tempDir);
  });

  it('should identify states needing re-eval for model change', () => {
    const state: SemanticState = {
      id: testId('migr-reval-1'),
      descriptor: createTestDescriptor({ modelId: 'gpt-4' }),
      createdAt: '2024-01-15T10:00:00Z',
      actor: 'test',
      integrityScore: 80,
    };

    store.putState(state);

    const result = simulateModelMigration(store, 'gpt-4', 'claude-3');

    expect(result.totalStates).toBe(1);
    expect(result.impacts[0].riskCategory).toBe('needs_re_eval');
    expect(result.summary.needsReEval).toBe(1);
  });

  it('should identify compatible states for same model', () => {
    const state: SemanticState = {
      id: testId('migr-compat-1'),
      descriptor: createTestDescriptor({ modelId: 'gpt-4', evalSnapshotId: 'eval-123' }),
      createdAt: '2024-01-15T10:00:00Z',
      actor: 'test',
      integrityScore: 100,
    };

    store.putState(state);

    const result = simulateModelMigration(store, 'gpt-4', 'gpt-4');

    expect(result.impacts[0].riskCategory).toBe('compatible');
    expect(result.summary.compatible).toBe(1);
  });

  it('should detect policy risk when model unchanged', () => {
    const state: SemanticState = {
      id: testId('migr-policy-1'),
      descriptor: createTestDescriptor({ modelId: 'gpt-4', policySnapshotId: 'policy-old' }),
      createdAt: '2024-01-15T10:00:00Z',
      actor: 'test',
      integrityScore: 80,
    };

    store.putState(state);

    // When model doesn't change but policy does, policy_risk is detected
    const result = simulateModelMigration(store, 'gpt-4', 'gpt-4', {
      policyRef: 'policy-new',
    });

    expect(result.impacts[0].riskCategory).toBe('policy_risk');
    expect(result.summary.policyRisk).toBe(1);
  });

  it('should summarize multiple states', () => {
    store.putState({
      id: testId('migr-sum-1'),
      descriptor: createTestDescriptor({ modelId: 'gpt-4' }),
      createdAt: '2024-01-15T10:00:00Z',
      actor: 'test',
      integrityScore: 80,
    });
    store.putState({
      id: testId('migr-sum-2'),
      descriptor: createTestDescriptor({ modelId: 'gpt-4' }),
      createdAt: '2024-01-15T11:00:00Z',
      actor: 'test',
      integrityScore: 90,
    });
    store.putState({
      id: testId('migr-sum-3'),
      descriptor: createTestDescriptor({ modelId: 'claude-3' }),
      createdAt: '2024-01-15T12:00:00Z',
      actor: 'test',
      integrityScore: 85,
    });

    const result = simulateModelMigration(store, 'gpt-4', 'claude-3');

    expect(result.totalStates).toBe(2); // Only gpt-4 states
    expect(result.summary.needsReEval).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Factory Functions', () => {
  describe('createSemanticState', () => {
    it('should create state with computed ID', () => {
      const descriptor = createTestDescriptor();
      const state = createSemanticState(descriptor);

      expect(state.id).toBe(computeSemanticStateId(descriptor));
      expect(state.descriptor).toEqual(descriptor);
    });

    it('should include actor and labels', () => {
      const descriptor = createTestDescriptor();
      const state = createSemanticState(descriptor, {
        actor: 'user-123',
        labels: { env: 'prod' },
      });

      expect(state.actor).toBe('user-123');
      expect(state.labels).toEqual({ env: 'prod' });
    });

    it('should compute integrity score', () => {
      const descriptor = createTestDescriptor();
      const state = createSemanticState(descriptor, {
        verificationStatus: {
          parityVerified: true,
          replayVerified: true,
          artifactSigned: true,
        },
      });

      expect(state.integrityScore).toBeGreaterThan(0);
    });
  });

  describe('createSemanticTransition', () => {
    it('should create transition with drift classification', () => {
      const fromState = createSemanticState(createTestDescriptor({ modelId: 'gpt-4' }));
      const toState = createSemanticState(createTestDescriptor({ modelId: 'claude-3' }));

      const transition = createSemanticTransition(fromState, toState, 'Model upgrade');

      expect(transition.fromId).toBe(fromState.id);
      expect(transition.toId).toBe(toState.id);
      expect(transition.reason).toBe('Model upgrade');
      expect(transition.driftCategories).toContain(DriftCategory.ModelDrift);
      expect(transition.changeVectors).toHaveLength(1);
    });

    it('should handle genesis transition', () => {
      const toState = createSemanticState(createTestDescriptor());

      const transition = createSemanticTransition(null, toState, 'Initial state');

      expect(transition.fromId).toBeUndefined();
      expect(transition.driftCategories).toHaveLength(0);
    });

    it('should compute integrity delta', () => {
      const fromState = createSemanticState(createTestDescriptor(), {
        verificationStatus: { parityVerified: true },
      });
      const toState = createSemanticState(createTestDescriptor(), {
        verificationStatus: {
          parityVerified: true,
          replayVerified: true,
          artifactSigned: true,
        },
      });

      const transition = createSemanticTransition(fromState, toState, 'Verification complete');

      expect(transition.integrityDelta).toBe(toState.integrityScore - fromState.integrityScore);
    });
  });
});
