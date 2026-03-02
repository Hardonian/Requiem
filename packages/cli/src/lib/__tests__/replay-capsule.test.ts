/**
 * Tests for Replay Attestation Capsule (Differentiator B)
 */

import { describe, it, expect } from 'vitest';
import {
  createCapsule,
  verifyCapsule,
  quickVerifyCapsule,
  serializeCapsule,
  deserializeCapsule,
  getCapsuleSummary,
  capsuleHasDrift,
} from '../replay-capsule.js';
import {
  createSemanticState,
  createSemanticTransition,
  DriftCategory as DriftCategoryValue,
} from '../semantic-state-machine.js';

describe('Replay Attestation Capsule', () => {
  const mockDescriptor = {
    modelId: 'gpt-4',
    modelVersion: '2024-01',
    promptTemplateId: 'test-template',
    promptTemplateVersion: '1.0.0',
    policySnapshotId: 'policy-abc123',
    contextSnapshotId: 'context-def456',
    runtimeId: 'node-20',
  };

  describe('createCapsule', () => {
    it('should create a capsule with all required fields', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);

      expect(capsule.version).toBe('1.0.0');
      expect(capsule.id).toBeDefined();
      expect(capsule.checksum).toBeDefined();
      expect(capsule.semanticState.id).toBe(state.id);
      expect(capsule.policySnapshot.id).toBe(mockDescriptor.policySnapshotId);
      expect(capsule.contextSnapshot.id).toBe(mockDescriptor.contextSnapshotId);
    });

    it('should include lineage slice', () => {
      const state1 = createSemanticState({ ...mockDescriptor, modelId: 'gpt-3.5' });
      const state2 = createSemanticState(mockDescriptor);
      const transition = createSemanticTransition(state1, state2, 'Model upgrade');

      const capsule = createCapsule(state2, [
        { state: state1 },
        { state: state2, transition },
      ]);

      expect(capsule.lineageSlice).toHaveLength(2);
    });

    it('should include optional eval snapshot', () => {
      const descriptor = {
        ...mockDescriptor,
        evalSnapshotId: 'eval-xyz789',
      };
      const state = createSemanticState(descriptor);
      const capsule = createCapsule(state, []);

      expect(capsule.evalSnapshot).toBeDefined();
      expect(capsule.evalSnapshot?.id).toBe('eval-xyz789');
    });

    it('should include integrity breakdown', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);

      expect(capsule.integrityBreakdown.total).toBe(state.integrityScore);
      expect(capsule.integrityBreakdown.policyBound).toBe(true);
      expect(capsule.integrityBreakdown.contextCaptured).toBe(true);
    });
  });

  describe('verifyCapsule', () => {
    it('should verify a valid capsule', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);

      const result = verifyCapsule(capsule);

      expect(result.valid).toBe(true);
      expect(result.checks.formatVersion).toBe(true);
      expect(result.checks.checksum).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail on bad checksum', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);
      const tamperedCapsule = { ...capsule, checksum: 'invalid' };

      const result = verifyCapsule(tamperedCapsule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Checksum'))).toBe(true);
    });

    it('should fail on wrong version', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);
      const badVersionCapsule = { ...capsule, version: '0.0.1' as const };

      const result = verifyCapsule(badVersionCapsule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
    });

    it('should include capsule ID in result', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);

      const result = verifyCapsule(capsule);

      expect(result.capsuleId).toBe(capsule.id);
    });
  });

  describe('quickVerifyCapsule', () => {
    it('should quickly verify valid capsule', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);

      expect(quickVerifyCapsule(capsule)).toBe(true);
    });

    it('should reject invalid checksum', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);
      const tampered = { ...capsule, checksum: 'bad' };

      expect(quickVerifyCapsule(tampered)).toBe(false);
    });

    it('should reject wrong version', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);
      const badVersion = { ...capsule, version: '0.0.1' as const };

      expect(quickVerifyCapsule(badVersion)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize capsule', () => {
      const state = createSemanticState(mockDescriptor);
      const original = createCapsule(state, []);

      const serialized = serializeCapsule(original);
      const deserialized = deserializeCapsule(serialized);

      expect(deserialized.id).toBe(original.id);
      expect(deserialized.checksum).toBe(original.checksum);
      expect(deserialized.semanticState.id).toBe(original.semanticState.id);
    });

    it('should throw on invalid JSON', () => {
      expect(() => deserializeCapsule('invalid json')).toThrow();
    });

    it('should throw on missing required fields', () => {
      expect(() => deserializeCapsule('{"version": "1.0.0"}')).toThrow();
    });
  });

  describe('getCapsuleSummary', () => {
    it('should extract summary from capsule', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);
      const summary = getCapsuleSummary(capsule);

      expect(summary.id).toBe(capsule.id);
      expect(summary.stateId).toBe(state.id);
      expect(summary.model).toContain('gpt-4');
      expect(summary.integrity).toBe(state.integrityScore);
    });
  });

  describe('capsuleHasDrift', () => {
    it('should return false when no drift classification', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);

      expect(capsuleHasDrift(capsule, DriftCategoryValue.ModelDrift)).toBe(false);
    });

    it('should check drift classification when present', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);
      const withDrift = {
        ...capsule,
        driftClassification: {
          driftCategories: [DriftCategoryValue.ModelDrift],
          changeVectors: [],
        },
      };

      expect(capsuleHasDrift(withDrift, DriftCategoryValue.ModelDrift)).toBe(true);
      expect(capsuleHasDrift(withDrift, DriftCategoryValue.PolicyDrift)).toBe(false);
    });
  });

  describe('determinism', () => {
    it('should create identical capsules for same inputs', () => {
      const state = createSemanticState(mockDescriptor, { actor: 'test' });
      const capsule1 = createCapsule(state, []);
      const capsule2 = createCapsule(state, []);

      // IDs should be same because checksum is derived from content
      expect(capsule1.checksum).toBe(capsule2.checksum);
    });

    it('should produce consistent verification results', () => {
      const state = createSemanticState(mockDescriptor);
      const capsule = createCapsule(state, []);

      const result1 = verifyCapsule(capsule);
      const result2 = verifyCapsule(capsule);

      expect(result1.valid).toBe(result2.valid);
      expect(result1.checks).toEqual(result2.checks);
    });
  });

  describe('lineage integrity', () => {
    it('should verify lineage chain', () => {
      const state1 = createSemanticState({ ...mockDescriptor, modelId: 'gpt-3.5' });
      const state2 = createSemanticState(mockDescriptor);
      const transition = createSemanticTransition(state1, state2, 'Upgrade');

      const capsule = createCapsule(state2, [
        { state: state1 },
        { state: state2, transition },
      ]);

      const result = verifyCapsule(capsule);

      expect(result.checks.lineageIntegrity).toBe(true);
    });
  });
});
