import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'ARTIFACT-MUTATION-DATASET',
  name: 'Artifact Mutation Dataset',
  description: 'Deterministic artifact mutations to validate CAS integrity checks',
  version: 1,
  schema_version: '1.0.0',
  item_count: 2,
  labels_schema: { category: 'artifact', subtype: 'mutation' },
} as const;

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: () => [
    { artifact_id: 'a1', original: 'hello', mutated: 'hello!', expected_change: true } as DatasetItem,
    { artifact_id: 'a2', original: 'proof', mutated: 'proof', expected_change: false } as DatasetItem,
  ],
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items) => {
    const result = defaultValidationResult([{ name: 'mutation_expectation_match', passed: true, details: {} }]);
    items.forEach((item, idx) => {
      const changed = item.original !== item.mutated;
      if (changed !== Boolean(item.expected_change)) {
        fail(result, { item_index: idx, field: 'expected_change', message: 'mutation expectation mismatch' });
      }
    });
    result.checks[0].passed = result.valid;
    return result;
  },
};
