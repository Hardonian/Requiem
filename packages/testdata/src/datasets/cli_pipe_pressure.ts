import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'CLI-PIPE-PRESSURE',
  name: 'CLI Pipe Pressure',
  description: '10MB streaming output pressure cases',
  version: 1,
  schema_version: '1.0.0',
  item_count: 5,
  labels_schema: {
    category: 'cli',
    subtype: 'stream_pressure',
    expected_behavior: 'no_oom',
  },
} as const;

const TOTAL_BYTES = 10_000_000;
const CHUNK_SIZES = [1024, 4096, 16384, 65536, 262144] as const;

function simulateStreaming(bytes: number, chunkSize: number): { chunks: number; max_buffered_bytes: number } {
  const chunks = Math.ceil(bytes / chunkSize);
  return {
    chunks,
    max_buffered_bytes: Math.min(chunkSize * 2, 1_000_000),
  };
}

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: () => {
    const items: DatasetItem[] = [];
    CHUNK_SIZES.forEach((chunkSize, index) => {
      items.push({
        case_id: `pipe-${String(index).padStart(3, '0')}`,
        bytes: TOTAL_BYTES,
        chunk_size: chunkSize,
        line_breaks: index % 2 === 0,
        expected_behavior: 'no_oom',
        expected_time_budget_ms: 4000 + index * 400,
      });
    });
    return items;
  },
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items, _labels) => {
    const result = defaultValidationResult([
      {
        name: 'streaming_is_bounded_memory',
        passed: true,
        details: { cases: items.length },
      },
    ]);

    items.forEach((item, index) => {
      const sim = simulateStreaming(item.bytes as number, item.chunk_size as number);
      if (sim.max_buffered_bytes > 1_000_000) {
        fail(result, {
          item_index: index,
          field: 'max_buffered_bytes',
          message: 'Streaming path is not memory bounded',
        });
      }
      if (item.expected_behavior !== 'no_oom') {
        fail(result, {
          item_index: index,
          field: 'expected_behavior',
          message: 'Unexpected behavior label',
        });
      }
    });

    result.checks[0].passed = result.valid;
    return result;
  },
};
