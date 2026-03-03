import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema, stableHashForItem } from './common.js';

const METADATA = {
  code: 'PERF-COLD-START',
  name: 'Performance Cold Start',
  description: 'Five-run baseline for command cold-start timing',
  version: 1,
  schema_version: '1.0.0',
  item_count: 5,
  labels_schema: {
    category: 'performance',
    subtype: 'cold_start_baseline',
  },
} as const;

const METRIC_KEYS = ['startup_ms', 'total_ms', 'rss_mb'];

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: (ctx) => {
    const envFingerprint = stableHashForItem({
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      tenant: ctx.tenant_id,
    });
    const items: DatasetItem[] = [];
    for (let i = 0; i < METADATA.item_count; i += 1) {
      items.push({
        run_index: i,
        command: 'rl --version',
        env_fingerprint: envFingerprint,
        expected_metric_keys: METRIC_KEYS,
      });
    }
    return items;
  },
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items, _labels) => {
    const result = defaultValidationResult([
      {
        name: 'cold_start_schema_valid',
        passed: true,
        details: { runs: items.length },
      },
    ]);

    items.forEach((item, index) => {
      const keys = item.expected_metric_keys as string[];
      if (JSON.stringify(keys) !== JSON.stringify(METRIC_KEYS)) {
        fail(result, {
          item_index: index,
          field: 'expected_metric_keys',
          message: 'Cold-start metric key schema drifted',
        });
      }
    });

    result.checks[0].passed = result.valid;
    return result;
  },
};
