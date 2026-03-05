import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'PIPELINE-EXECUTION-DATASET',
  name: 'Pipeline Execution Dataset',
  description: 'Deterministic stage execution data',
  version: 1,
  schema_version: '1.0.0',
  item_count: 2,
  labels_schema: { category: 'pipeline', subtype: 'execution' },
} as const;

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: () => [
    { pipeline: 'build-release', stages: ['plan', 'run', 'verify'], status: 'ok' } as DatasetItem,
    { pipeline: 'nightly-replay', stages: ['collect', 'replay', 'diff'], status: 'ok' } as DatasetItem,
  ],
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items) => {
    const result = defaultValidationResult([{ name: 'pipeline_has_verify_stage', passed: true, details: {} }]);
    items.forEach((item, idx) => {
      const stages = item.stages as string[];
      if (!stages.includes('verify') && !stages.includes('diff')) {
        fail(result, { item_index: idx, field: 'stages', message: 'pipeline must include verify or diff stage' });
      }
    });
    result.checks[0].passed = result.valid;
    return result;
  },
};
