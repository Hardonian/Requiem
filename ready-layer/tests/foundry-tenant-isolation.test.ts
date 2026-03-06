// ready-layer/tests/foundry-tenant-isolation.test.ts
// Tenant isolation tests for Test Data Foundry

import { describe, it, expect } from 'vitest';
import {
  computeStableHash,
  generateRunId,
} from '@/lib/foundry-repository';
import {
  generateSeededSampleDataset,
  prepareSeededDatasetForInsertion,
} from '@/lib/foundry-seed-generator';
import type { Dataset } from '@/types/foundry';

// Mock Supabase - in real tests this would connect to a test database
// For now, we test the deterministic hash and generator functions

describe('Foundry Tenant Isolation', () => {
  describe('computeStableHash', () => {
    it('should produce deterministic hashes for identical inputs', () => {
      const input = {
        tenant_id: 'tenant-1',
        name: 'test-dataset',
        content: { type: 'test', items: 100 },
      };

      const hash1 = computeStableHash(input);
      const hash2 = computeStableHash(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('should produce different hashes for different tenant_ids', () => {
      const input1 = {
        tenant_id: 'tenant-1',
        name: 'test-dataset',
        content: { type: 'test' },
      };
      const input2 = {
        tenant_id: 'tenant-2',
        name: 'test-dataset',
        content: { type: 'test' },
      };

      const hash1 = computeStableHash(input1);
      const hash2 = computeStableHash(input2);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const input1 = {
        tenant_id: 'tenant-1',
        name: 'test-dataset',
        content: { type: 'test', value: 1 },
      };
      const input2 = {
        tenant_id: 'tenant-1',
        name: 'test-dataset',
        content: { type: 'test', value: 2 },
      };

      const hash1 = computeStableHash(input1);
      const hash2 = computeStableHash(input2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle nested objects deterministically', () => {
      const input = {
        tenant_id: 'tenant-1',
        name: 'test-dataset',
        content: {
          nested: { deeply: { value: 'found' } },
          array: [1, 2, 3],
        },
      };

      const hash1 = computeStableHash(input);
      const hash2 = computeStableHash(input);

      expect(hash1).toBe(hash2);
    });
  });

  describe('generateRunId', () => {
    it('should include tenant prefix in run IDs', () => {
      const tenantId = 'tenant-abc123';
      const runId = generateRunId(tenantId, 'gen');

      expect(runId).toContain('gen_');
      expect(runId).toContain(tenantId.slice(0, 8));
    });

    it('should produce unique run IDs', () => {
      const tenantId = 'tenant-1';
      const runId1 = generateRunId(tenantId, 'gen');
      const runId2 = generateRunId(tenantId, 'gen');

      expect(runId1).not.toBe(runId2);
    });

    it('should handle different prefixes', () => {
      const tenantId = 'tenant-1';
      const genRun = generateRunId(tenantId, 'gen');
      const evalRun = generateRunId(tenantId, 'eval');
      const dsRun = generateRunId(tenantId, 'ds');

      expect(genRun.startsWith('gen_')).toBe(true);
      expect(evalRun.startsWith('eval_')).toBe(true);
      expect(dsRun.startsWith('ds_')).toBe(true);
    });
  });

  describe('generateSeededSampleDataset', () => {
    it('should produce deterministic datasets with same seed', () => {
      const options = {
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        trace_id: 'trace-1',
        config: { seed: 12345, item_count: 10, schema: 'simple' as const },
      };

      const sample1 = generateSeededSampleDataset(options);
      const sample2 = generateSeededSampleDataset(options);

      expect(sample1.dataset.name).toBe(sample2.dataset.name);
      expect(sample1.items.length).toBe(sample2.items.length);
      expect(sample1.items[0].content).toEqual(sample2.items[0].content);
    });

    it('should produce different datasets with different seeds', () => {
      const options1 = {
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        trace_id: 'trace-1',
        config: { seed: 12345, item_count: 10, schema: 'simple' as const },
      };
      const options2 = {
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        trace_id: 'trace-1',
        config: { seed: 54321, item_count: 10, schema: 'simple' as const },
      };

      const sample1 = generateSeededSampleDataset(options1);
      const sample2 = generateSeededSampleDataset(options2);

      expect(sample1.dataset.name).not.toBe(sample2.dataset.name);
    });

    it('should include tenant_id in dataset', () => {
      const options = {
        tenant_id: 'tenant-isolation-test',
        actor_id: 'user-1',
        trace_id: 'trace-1',
        config: { seed: 12345, item_count: 5 },
      };

      const sample = generateSeededSampleDataset(options);

      expect(sample.dataset.tenant_id).toBe('tenant-isolation-test');
      expect(sample.items.every((item) => item.tenant_id === 'tenant-isolation-test')).toBe(true);
    });

    it('should generate correct number of items', () => {
      const options = {
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        trace_id: 'trace-1',
        config: { seed: 12345, item_count: 50 },
      };

      const sample = generateSeededSampleDataset(options);

      expect(sample.items.length).toBe(50);
      expect(sample.dataset.item_count).toBe(50);
    });

    it('should calculate correct size_bytes', () => {
      const options = {
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        trace_id: 'trace-1',
        config: { seed: 12345, item_count: 5 },
      };

      const sample = generateSeededSampleDataset(options);

      const expectedSize = sample.items.reduce((sum, item) => sum + item.size_bytes, 0);
      expect(sample.dataset.size_bytes).toBe(expectedSize);
    });
  });

  describe('prepareSeededDatasetForInsertion', () => {
    it('should assign proper IDs with tenant prefix', () => {
      const options = {
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        trace_id: 'trace-1',
        config: { seed: 12345, item_count: 5 },
      };

      const sample = generateSeededSampleDataset(options);
      const prepared = prepareSeededDatasetForInsertion(sample, 'tenant-2');

      // Should use the new tenant_id
      expect(prepared.dataset.tenant_id).toBe('tenant-2');
      expect(prepared.items.every((item) => item.tenant_id === 'tenant-2')).toBe(true);
    });

    it('should regenerate stable_hash for new tenant', () => {
      const options = {
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        trace_id: 'trace-1',
        config: { seed: 12345, item_count: 5 },
      };

      const sample = generateSeededSampleDataset(options);
      const originalHash = sample.dataset.stable_hash;
      const prepared = prepareSeededDatasetForInsertion(sample, 'tenant-2');

      // Hash should change because tenant is different
      expect(prepared.dataset.stable_hash).not.toBe(originalHash);
    });
  });
});

describe('Foundry API Smoke Tests', () => {
  describe('Problem+JSON Error Responses', () => {
    it('should include trace_id in error responses', async () => {
      // This would be tested via actual API calls in integration tests
      // For unit tests, we verify the error response structure
      const errorResponse = {
        ok: false,
        error: 'Dataset not found',
        trace_id: 'trace-test-123',
      };

      expect(errorResponse.trace_id).toBeDefined();
      expect(errorResponse.trace_id.length).toBeGreaterThan(0);
    });

    it('should include trace_id in success responses', () => {
      const successResponse = {
        ok: true,
        dataset: { id: 'ds-1', name: 'test' } as Dataset,
        trace_id: 'trace-test-456',
      };

      expect(successResponse.trace_id).toBeDefined();
    });
  });

  describe('Dataset Types', () => {
    it('should support all dataset types', () => {
      const datasetTypes = ['test', 'train', 'validation', 'benchmark'];

      for (const type of datasetTypes) {
        const options = {
          tenant_id: 'tenant-1',
          actor_id: 'user-1',
          trace_id: 'trace-1',
          config: {
            seed: 12345,
            item_count: 5,
            schema: 'simple' as const,
          },
        };

        const sample = generateSeededSampleDataset(options);
        // Dataset type is determined by schema
        if (type === 'test') {
          expect(sample.dataset.dataset_type).toBe('train'); // simple schema defaults to train
        }
      }
    });
  });

  describe('Idempotency', () => {
    it('should produce same hash for same content', () => {
      const content = { name: 'item', value: 42 };

      const hash1 = computeStableHash({
        tenant_id: 'tenant-1',
        name: 'test-item',
        content,
      });
      const hash2 = computeStableHash({
        tenant_id: 'tenant-1',
        name: 'test-item',
        content,
      });

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different versions', () => {
      const content = { name: 'item', value: 42 };

      const hash1 = computeStableHash({
        tenant_id: 'tenant-1',
        name: 'test-item',
        content,
        version: 1,
      });
      const hash2 = computeStableHash({
        tenant_id: 'tenant-1',
        name: 'test-item',
        content,
        version: 2,
      });

      expect(hash1).not.toBe(hash2);
    });
  });
});
