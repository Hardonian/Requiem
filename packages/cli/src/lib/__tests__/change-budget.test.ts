/**
 * Tests for Change Budget Governance (Differentiator C)
 */

import { describe, it, expect } from 'vitest';
import {
  createPermissiveBudget,
  createStrictBudget,
  createProductionBudget,
  createCustomBudget,
  checkChangeBudget,
  serializeBudget,
  deserializeBudget,
  type BudgetRuleSpec,
} from '../change-budget.js';
import {
  createSemanticState,
  DriftCategory,
} from '../semantic-state-machine.js';

describe('Change Budget Governance', () => {
  const mockDescriptor = {
    modelId: 'gpt-4',
    modelVersion: '2024-01',
    promptTemplateId: 'test-template',
    promptTemplateVersion: '1.0.0',
    policySnapshotId: 'policy-abc123',
    contextSnapshotId: 'context-def456',
    runtimeId: 'node-20',
  };

  describe('createPermissiveBudget', () => {
    it('should allow all changes', () => {
      const budget = createPermissiveBudget('permissive-test');
      expect(budget.name).toBe('permissive-test');
      expect(budget.defaultRule.maxSignificance).toBe('critical');
    });
  });

  describe('createStrictBudget', () => {
    it('should require approval for model drift', () => {
      const budget = createStrictBudget('strict-test');
      const modelRule = budget.rules.get(DriftCategory.ModelDrift);
      expect(modelRule?.requiresApproval).toBe(true);
    });

    it('should require approval for policy drift', () => {
      const budget = createStrictBudget('strict-test');
      const policyRule = budget.rules.get(DriftCategory.PolicyDrift);
      expect(policyRule?.requiresApproval).toBe(true);
    });
  });

  describe('createProductionBudget', () => {
    it('should disallow model drift entirely', () => {
      const budget = createProductionBudget('prod-test');
      const modelRule = budget.rules.get(DriftCategory.ModelDrift);
      expect(modelRule?.maxSignificance).toBeNull();
    });

    it('should disallow prompt drift entirely', () => {
      const budget = createProductionBudget('prod-test');
      const promptRule = budget.rules.get(DriftCategory.PromptDrift);
      expect(promptRule?.maxSignificance).toBeNull();
    });
  });

  describe('createCustomBudget', () => {
    it('should create budget from specs', () => {
      const specs: BudgetRuleSpec[] = [
        { category: DriftCategory.ModelDrift, maxSignificance: 'major', requiresApproval: true },
        { category: DriftCategory.ContextDrift, maxSignificance: 'minor' },
      ];

      const budget = createCustomBudget('custom-test', specs, 'minor');

      expect(budget.rules.get(DriftCategory.ModelDrift)?.maxSignificance).toBe('major');
      expect(budget.rules.get(DriftCategory.ContextDrift)?.maxSignificance).toBe('minor');
      expect(budget.defaultRule.maxSignificance).toBe('minor');
    });

    it('should handle "none" as null maxSignificance', () => {
      const specs: BudgetRuleSpec[] = [
        { category: DriftCategory.ModelDrift, maxSignificance: 'none' },
      ];

      const budget = createCustomBudget('custom-test', specs);
      expect(budget.rules.get(DriftCategory.ModelDrift)?.maxSignificance).toBeNull();
    });
  });

  describe('checkChangeBudget', () => {
    it('should pass for no drift', () => {
      const state = createSemanticState(mockDescriptor);
      const budget = createPermissiveBudget('test');

      // Check same state (no drift)
      const result = checkChangeBudget(budget, state, state);

      expect(result.withinBudget).toBe(true);
      expect(result.summary.totalChanges).toBe(0);
    });

    it('should detect model drift', () => {
      const fromState = createSemanticState({
        ...mockDescriptor,
        modelId: 'gpt-3.5',
      });
      const toState = createSemanticState(mockDescriptor);
      const budget = createPermissiveBudget('test');

      const result = checkChangeBudget(budget, fromState, toState);

      expect(result.summary.totalChanges).toBeGreaterThan(0);
      expect(result.categoryResults.some(r => r.category === DriftCategory.ModelDrift)).toBe(true);
    });

    it('should block disallowed drift', () => {
      const fromState = createSemanticState({
        ...mockDescriptor,
        modelId: 'gpt-3.5',
      });
      const toState = createSemanticState(mockDescriptor);
      const budget = createProductionBudget('prod');

      const result = checkChangeBudget(budget, fromState, toState);

      expect(result.withinBudget).toBe(false);
      expect(result.summary.blockedChanges).toBeGreaterThan(0);
    });

    it('should allow allowed drift', () => {
      const fromState = createSemanticState({
        ...mockDescriptor,
        contextSnapshotId: 'context-old',
      });
      const toState = createSemanticState(mockDescriptor);
      const budget = createPermissiveBudget('test');

      const result = checkChangeBudget(budget, fromState, toState);

      expect(result.withinBudget).toBe(true);
    });

    it('should pass for genesis state', () => {
      const toState = createSemanticState(mockDescriptor);
      const budget = createProductionBudget('prod');

      const result = checkChangeBudget(budget, null, toState);

      expect(result.withinBudget).toBe(true);
      expect(result.summary.totalChanges).toBe(0);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize budget', () => {
      const specs: BudgetRuleSpec[] = [
        { category: DriftCategory.ModelDrift, maxSignificance: 'major', requiresApproval: true },
      ];
      const original = createCustomBudget('serialize-test', specs);

      const serialized = serializeBudget(original);
      const deserialized = deserializeBudget(serialized);

      expect(deserialized.name).toBe(original.name);
      expect(deserialized.version).toBe(original.version);
      expect(deserialized.rules.get(DriftCategory.ModelDrift)?.maxSignificance).toBe('major');
    });
  });

  describe('determinism', () => {
    it('should produce consistent results for same inputs', () => {
      const fromState = createSemanticState({
        ...mockDescriptor,
        modelId: 'gpt-3.5',
      });
      const toState = createSemanticState(mockDescriptor);
      const budget = createStrictBudget('test');

      const result1 = checkChangeBudget(budget, fromState, toState);
      const result2 = checkChangeBudget(budget, fromState, toState);

      expect(result1.withinBudget).toBe(result2.withinBudget);
      expect(result1.summary.totalChanges).toBe(result2.summary.totalChanges);
    });
  });
});
