import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'REPO-LINEAGE-DATASET',
  name: 'Repository Lineage Dataset',
  description: 'Synthetic deterministic repo lineage commits',
  version: 1,
  schema_version: '1.0.0',
  item_count: 2,
  labels_schema: { category: 'lineage', subtype: 'repo' },
} as const;

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: () => [
    { repo: 'alpha', commits: ['c1', 'c2', 'c3'], parent_map: { c2: 'c1', c3: 'c2' } } as DatasetItem,
    { repo: 'beta', commits: ['d1', 'd2'], parent_map: { d2: 'd1' } } as DatasetItem,
  ],
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items) => {
    const result = defaultValidationResult([{ name: 'lineage_parent_integrity', passed: true, details: {} }]);
    items.forEach((item, idx) => {
      const commits = item.commits as string[];
      const parentMap = item.parent_map as Record<string, string>;
      Object.entries(parentMap).forEach(([child, parent]) => {
        if (!commits.includes(child) || !commits.includes(parent)) {
          fail(result, { item_index: idx, field: 'parent_map', message: `missing commit for ${child}->${parent}` });
        }
      });
    });
    result.checks[0].passed = result.valid;
    return result;
  },
};
