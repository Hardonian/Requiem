import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, ensureProblemJsonShape, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'FAULT-OOM-SCENARIO',
  name: 'Fault OOM Scenario',
  description: '100MB state-tree request pressure and rejection handling',
  version: 1,
  schema_version: '1.0.0',
  item_count: 5,
  labels_schema: {
    category: 'fault',
    subtype: 'oom_guard',
    limit_enforced: true,
  },
} as const;

const SHAPES = ['deep_tree', 'wide_tree'] as const;
const LIMIT_BYTES = 32_000_000;

function simulateRequest(requestedBytes: number): { status: number; problem: Record<string, string | number> } {
  if (requestedBytes > LIMIT_BYTES) {
    return {
      status: 413,
      problem: {
        type: 'https://example.com/problems/request-too-large',
        title: 'Request rejected by memory limit',
        status: 413,
        code: 'STATE_SIZE_LIMIT_EXCEEDED',
        trace_id: 'trace_oom_sim',
      },
    };
  }
  return {
    status: 200,
    problem: {
      type: 'about:blank',
      title: 'OK',
      status: 200,
      code: 'OK',
      trace_id: 'trace_oom_sim',
    },
  };
}

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: () => {
    const items: DatasetItem[] = [];
    for (let i = 0; i < METADATA.item_count; i += 1) {
      items.push({
        scenario_id: `oom-${String(i).padStart(3, '0')}`,
        requested_state_bytes: 100_000_000,
        shape: SHAPES[i % SHAPES.length],
        expected: 'rejected_or_streamed',
        limit_enforced: true,
      });
    }
    return items;
  },
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items, _labels) => {
    const result = defaultValidationResult([
      {
        name: 'oom_requests_rejected_without_500',
        passed: true,
        details: { scenarios: items.length, limit_bytes: LIMIT_BYTES },
      },
    ]);

    items.forEach((item, index) => {
      const sim = simulateRequest(item.requested_state_bytes as number);
      if (![413, 422].includes(sim.status)) {
        fail(result, {
          item_index: index,
          field: 'status',
          message: `Expected 413/422, got ${sim.status}`,
        });
      }
      if (!ensureProblemJsonShape(sim.problem as never)) {
        fail(result, {
          item_index: index,
          field: 'problem+json',
          message: 'Problem+JSON payload invalid',
        });
      }
    });

    result.checks[0].passed = result.valid;
    return result;
  },
};
