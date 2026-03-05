import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'DRIFT-DETECTION-DATASET',
  name: 'Drift Detection Dataset',
  description: 'Deterministic drift vectors for learning analysis',
  version: 1,
  schema_version: '1.0.0',
  item_count: 3,
  labels_schema: { category: 'learning', subtype: 'drift' },
} as const;

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: () => [
    { run_id: 'r1', baseline: 0.11, observed: 0.11, drift: 0 } as DatasetItem,
    { run_id: 'r2', baseline: 0.11, observed: 0.14, drift: 0.03 } as DatasetItem,
    { run_id: 'r3', baseline: 0.11, observed: 0.2, drift: 0.09 } as DatasetItem,
  ],
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items) => {
    const result = defaultValidationResult([{ name: 'drift_vector_valid', passed: true, details: {} }]);
    items.forEach((item, idx) => {
      const delta = Number((Number(item.observed) - Number(item.baseline)).toFixed(2));
      if (delta !== Number(item.drift)) {
        fail(result, { item_index: idx, field: 'drift', message: `expected ${delta}, got ${item.drift}` });
      }
    });
    result.checks[0].passed = result.valid;
    return result;
  },
};
