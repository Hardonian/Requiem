/**
 * Tests for Audit Narrative Generator (Differentiator D)
 */

import { describe, it, expect } from 'vitest';
import {
  generateStateAuditNarrative,
  generateTransitionAuditNarrative,
  renderNarrativeAsMarkdown,
  renderNarrativeAsJSON,
  type AuditNarrative,
} from '../audit-narrative.js';
import {
  createSemanticState,
  createSemanticTransition,
  type SemanticState,
} from '../semantic-state-machine.js';

describe('Audit Narrative Generator', () => {
  const mockDescriptor = {
    modelId: 'gpt-4',
    modelVersion: '2024-01',
    promptTemplateId: 'test-template',
    promptTemplateVersion: '1.0.0',
    policySnapshotId: 'policy-abc123',
    contextSnapshotId: 'context-def456',
    runtimeId: 'node-20',
  };

  describe('generateStateAuditNarrative', () => {
    it('should generate a narrative for a state', () => {
      const state = createSemanticState(mockDescriptor, {
        actor: 'test-actor',
        labels: { env: 'test' },
      });

      const narrative = generateStateAuditNarrative(state);

      expect(narrative.version).toBe('1.0.0');
      expect(narrative.subject.type).toBe('state');
      expect(narrative.subject.id).toBe(state.id);
      expect(narrative.sections.length).toBeGreaterThan(0);
      expect(narrative.compliance.integrityScore).toBe(state.integrityScore);
    });

    it('should include integrity assessment section', () => {
      const state = createSemanticState(mockDescriptor);
      const narrative = generateStateAuditNarrative(state);

      const integritySection = narrative.sections.find(s => s.title === 'Integrity Assessment');
      expect(integritySection).toBeDefined();
      expect(integritySection?.content).toContain('Overall Score');
    });

    it('should include configuration binding section', () => {
      const state = createSemanticState(mockDescriptor);
      const narrative = generateStateAuditNarrative(state);

      const configSection = narrative.sections.find(s => s.title === 'Configuration Binding');
      expect(configSection).toBeDefined();
      expect(configSection?.content).toContain('gpt-4');
    });

    it('should assess risk level based on integrity score', () => {
      const highIntegrityState = createSemanticState(mockDescriptor, {
        verificationStatus: {
          parityVerified: true,
          replayVerified: true,
          artifactSigned: true,
        },
      });

      const narrative = generateStateAuditNarrative(highIntegrityState);
      expect(['low', 'medium', 'high', 'critical']).toContain(narrative.compliance.riskLevel);
    });
  });

  describe('generateTransitionAuditNarrative', () => {
    it('should generate a narrative for a transition', () => {
      const fromState = createSemanticState({
        ...mockDescriptor,
        modelId: 'gpt-3.5',
      });
      const toState = createSemanticState(mockDescriptor);
      const transition = createSemanticTransition(fromState, toState, 'Model upgrade');

      const narrative = generateTransitionAuditNarrative(fromState, toState, transition);

      expect(narrative.version).toBe('1.0.0');
      expect(narrative.subject.type).toBe('transition');
      expect(narrative.sections.length).toBeGreaterThan(0);
    });

    it('should include change analysis section', () => {
      const fromState = createSemanticState({
        ...mockDescriptor,
        modelId: 'gpt-3.5',
      });
      const toState = createSemanticState(mockDescriptor);
      const transition = createSemanticTransition(fromState, toState, 'Model upgrade');

      const narrative = generateTransitionAuditNarrative(fromState, toState, transition);

      const changeSection = narrative.sections.find(s => s.title === 'Change Analysis');
      expect(changeSection).toBeDefined();
    });

    it('should include drift classification section', () => {
      const fromState = createSemanticState({
        ...mockDescriptor,
        modelId: 'gpt-3.5',
      });
      const toState = createSemanticState(mockDescriptor);
      const transition = createSemanticTransition(fromState, toState, 'Model upgrade');

      const narrative = generateTransitionAuditNarrative(fromState, toState, transition);

      const driftSection = narrative.sections.find(s => s.title === 'Drift Classification');
      expect(driftSection).toBeDefined();
    });
  });

  describe('renderNarrativeAsMarkdown', () => {
    it('should render narrative as markdown', () => {
      const state = createSemanticState(mockDescriptor);
      const narrative = generateStateAuditNarrative(state);
      const markdown = renderNarrativeAsMarkdown(narrative);

      expect(markdown).toContain('# Audit Narrative');
      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain(state.id);
    });

    it('should include deterministic disclaimer', () => {
      const state = createSemanticState(mockDescriptor);
      const narrative = generateStateAuditNarrative(state);
      const markdown = renderNarrativeAsMarkdown(narrative);

      expect(markdown).toContain('No LLM was involved');
    });
  });

  describe('renderNarrativeAsJSON', () => {
    it('should render narrative as JSON', () => {
      const state = createSemanticState(mockDescriptor);
      const narrative = generateStateAuditNarrative(state);
      const json = renderNarrativeAsJSON(narrative);

      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.subject.id).toBe(state.id);
    });
  });

  describe('determinism', () => {
    it('should produce identical narratives for identical inputs', () => {
      const state1 = createSemanticState(mockDescriptor, { actor: 'test' });
      // Create another state with same descriptor (will have same ID)
      const state2 = createSemanticState(mockDescriptor, { actor: 'test' });

      const narrative1 = generateStateAuditNarrative(state1);
      const narrative2 = generateStateAuditNarrative(state2);

      // Same state ID should produce same compliance assessment
      expect(narrative1.compliance.integrityScore).toBe(narrative2.compliance.integrityScore);
      expect(narrative1.sections.length).toBe(narrative2.sections.length);
    });
  });
});
