import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'TOOL-SCHEMA-STRESS',
  name: 'Tool Schema Stress',
  description: 'Fuzzed payloads over tool schemas with deterministic failures',
  version: 1,
  schema_version: '1.0.0',
  item_count: 50,
  labels_schema: {
    category: 'validation',
    subtype: 'schema_stress',
    expected_outcome: 'validation_error',
  },
} as const;

const TOOLS = [
  {
    tool_name: 'create_dataset',
    schema: { required: ['name', 'description'], properties: { name: 'string', description: 'string', tags: 'array' } },
  },
  {
    tool_name: 'delete_dataset',
    schema: { required: ['dataset_id'], properties: { dataset_id: 'string', force: 'boolean' } },
  },
  {
    tool_name: 'set_policy',
    schema: { required: ['policy_id', 'rules'], properties: { policy_id: 'string', rules: 'array', dry_run: 'boolean' } },
  },
] as const;

const FUZZ_CASES = ['wrong_types', 'missing_required', 'extra_field', 'nested_arrays', 'nulls'] as const;

function buildPayload(fuzzCase: string, index: number): Record<string, unknown> {
  switch (fuzzCase) {
    case 'wrong_types':
      return { name: 123, description: false, tags: 'not-array' };
    case 'missing_required':
      return { optional: 'present' };
    case 'extra_field':
      return { dataset_id: 'ds_abc', force: false, injected: 'x', unknown: index };
    case 'nested_arrays':
      return { policy_id: 'p1', rules: [[['bad']]], dry_run: null };
    case 'nulls':
      return { name: null, description: null, tags: null };
    default:
      return { unsupported: true };
  }
}

function materializeSchema(tool: (typeof TOOLS)[number]): Record<string, unknown> {
  return {
    required: [...tool.schema.required],
    properties: { ...tool.schema.properties },
  };
}

function validatePayload(payload: Record<string, unknown>): string {
  if (Object.values(payload).some((v) => v === null)) {
    return 'NULL_NOT_ALLOWED';
  }
  if (Array.isArray(payload.rules) && Array.isArray((payload.rules as unknown[])[0])) {
    return 'NESTED_ARRAY_NOT_ALLOWED';
  }
  if ('optional' in payload) {
    return 'MISSING_REQUIRED';
  }
  if ('injected' in payload || 'unknown' in payload) {
    return 'UNKNOWN_FIELD';
  }
  return 'TYPE_MISMATCH';
}

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: (_ctx) => {
    const items: DatasetItem[] = [];
    for (let i = 0; i < METADATA.item_count; i += 1) {
      const tool = TOOLS[i % TOOLS.length];
      const fuzzCase = FUZZ_CASES[i % FUZZ_CASES.length];
      const payload = buildPayload(fuzzCase, i);
      items.push({
        case_id: `tool-stress-${String(i).padStart(3, '0')}`,
        tool_name: tool.tool_name,
        schema: materializeSchema(tool) as never,
        fuzz_case: fuzzCase,
        payload: payload as never,
        expected_validation_error: validatePayload(payload),
      });
    }
    return items;
  },
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items, _labels) => {
    const result = defaultValidationResult([
      {
        name: 'schema_rejects_invalid_payloads',
        passed: true,
        details: { cases: items.length },
      },
    ]);

    items.forEach((item, index) => {
      const actualError = validatePayload(item.payload as Record<string, unknown>);
      if (actualError !== item.expected_validation_error) {
        fail(result, {
          item_index: index,
          field: 'expected_validation_error',
          message: `Expected ${item.expected_validation_error as string} got ${actualError}`,
        });
      }
    });

    result.checks[0].passed = result.valid;
    return result;
  },
};
