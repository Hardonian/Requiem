/**
 * Dataset: TOOL-SCHEMA-STRESS
 * Goal: 50 tool calls with fuzzed argument types.
 */

import type { SeededRNG } from '../rng.js';
import type { DatasetGenerator, DatasetMetadata, RegisteredDataset } from '../registry.js';

const VERSION = 1;
const SCHEMA_VERSION = '1.0.0';

/**
 * Mock tool schemas for testing.
 */
const TOOL_SCHEMAS: Record<string, { name: string; parameters: { type: string; required?: string[]; properties: Record<string, unknown> } }> = {
  'create_dataset': {
    name: 'create_dataset',
    parameters: {
      type: 'object',
      required: ['name', 'description'],
      properties: {
        name: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  'delete_dataset': {
    name: 'delete_dataset',
    parameters: {
      type: 'object',
      required: ['dataset_id'],
      properties: {
        dataset_id: { type: 'string' },
        force: { type: 'boolean' },
      },
    },
  },
  'update_policy': {
    name: 'update_policy',
    parameters: {
      type: 'object',
      required: ['policy_id', 'rules'],
      properties: {
        policy_id: { type: 'string' },
        rules: { type: 'array' },
        priority: { type: 'number' },
      },
    },
  },
  'invite_user': {
    name: 'invite_user',
    parameters: {
      type: 'object',
      required: ['email', 'role'],
      properties: {
        email: { type: 'string' },
        role: { type: 'string' },
        teams: { type: 'array' },
      },
    },
  },
  'create_api_key': {
    name: 'create_api_key',
    parameters: {
      type: 'object',
      required: ['name', 'scopes'],
      properties: {
        name: { type: 'string' },
        scopes: { type: 'array' },
        expires_at: { type: 'string' },
      },
    },
  },
};

const TOOL_NAMES = Object.keys(TOOL_SCHEMAS);

const FUZZ_CASES = [
  'wrong_type',
  'missing_required',
  'extra_field',
  'nested_array',
  'null_value',
  'empty_string',
  'invalid_enum',
  'wrong_nested_type',
];

const EXPECTED_ERRORS = [
  'VALIDATION_ERROR',
  'INVALID_TYPE',
  'MISSING_REQUIRED_FIELD',
  'UNKNOWN_FIELD',
  'INVALID_VALUE',
];

export const metadata: DatasetMetadata = {
  code: 'TOOL-SCHEMA-STRESS',
  name: 'Tool Schema Stress Test',
  description: '50 tool calls with fuzzed argument types to stress test validation',
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  itemCount: 50,
  labels: {
    category: 'validation',
    subtype: 'schema_stress',
  },
};

/**
 * Generate fuzz case based on tool schema and fuzz case type.
 */
function generateFuzzPayload(
  toolName: string,
  fuzzCase: string
): Record<string, unknown> {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    return { name: toolName, payload: {} };
  }
  const props = schema.parameters.properties;

  switch (fuzzCase) {
    case 'wrong_type':
      return {
        name: toolName,
        payload: Object.fromEntries(
          Object.keys(props).map((k) => [k, 'wrong_type_string'])
        ),
      };

    case 'missing_required':
      return {
        name: toolName,
        payload: { optional_field: 'present' },
      };

    case 'extra_field':
      return {
        name: toolName,
        payload: {
          ...Object.fromEntries(Object.keys(props).map((k) => [k, 'value'])),
          unknown_extra_field: 'should cause validation error',
          another_unknown: 123,
        },
      };

    case 'nested_array':
      return {
        name: toolName,
        payload: Object.fromEntries(
          Object.keys(props).map((k) => [k, ['nested', 'array']])
        ),
      };

    case 'null_value': {
      const nullPayload: Record<string, unknown> = {};
      for (const key of Object.keys(props)) {
        nullPayload[key] = null;
      }
      return { name: toolName, payload: nullPayload };
    }

    case 'empty_string': {
      const emptyPayload: Record<string, unknown> = {};
      for (const key of Object.keys(props)) {
        emptyPayload[key] = '';
      }
      return { name: toolName, payload: emptyPayload };
    }

    case 'invalid_enum':
      return {
        name: toolName,
        payload: {
          ...Object.fromEntries(Object.keys(props).map((k) => [k, 'invalid_value'])),
          role: 'super_admin',
        },
      };

    case 'wrong_nested_type':
      return {
        name: toolName,
        payload: Object.fromEntries(
          Object.keys(props).map((k) => [k, { nested: 'object' }])
        ),
      };

    default:
      return { name: toolName, payload: {} };
  }
}

/**
 * Generate tool schema stress test cases.
 */
export function* generate(rng: SeededRNG, _seed: number, _version: number): Generator<{
  case_id: string;
  tool_name: string;
  schema: typeof TOOL_SCHEMAS[string];
  fuzz_case: string;
  payload: Record<string, unknown>;
  expected_validation_error: string;
}> {
  for (let i = 0; i < 50; i++) {
    const toolName = rng.pick(TOOL_NAMES);
    const fuzzCase = rng.pick(FUZZ_CASES);
    const fuzzPayload = generateFuzzPayload(toolName, fuzzCase);
    const expectedError = rng.pick(EXPECTED_ERRORS);

    yield {
      case_id: `stress-${i.toString().padStart(3, '0')}`,
      tool_name: toolName,
      schema: TOOL_SCHEMAS[toolName],
      fuzz_case: fuzzCase,
      payload: fuzzPayload.payload as Record<string, unknown>,
      expected_validation_error: expectedError,
    };
  }
}

/**
 * Validator for tool schema stress dataset.
 */
export function validate(
  items: Record<string, unknown>[],
  _labels: Record<string, unknown>[]
): { valid: boolean; errors: { itemIndex: number; field: string; message: string }[]; warnings: { itemIndex: number; field: string; message: string }[] } {
  const errors: { itemIndex: number; field: string; message: string }[] = [];
  const warnings: { itemIndex: number; field: string; message: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.case_id) {
      errors.push({ itemIndex: i, field: 'case_id', message: 'Missing required field: case_id' });
    }
    if (!item.tool_name) {
      errors.push({ itemIndex: i, field: 'tool_name', message: 'Missing required field: tool_name' });
    }
    if (!item.schema) {
      errors.push({ itemIndex: i, field: 'schema', message: 'Missing required field: schema' });
    }
    if (!item.fuzz_case) {
      errors.push({ itemIndex: i, field: 'fuzz_case', message: 'Missing required field: fuzz_case' });
    }
    if (!item.payload) {
      errors.push({ itemIndex: i, field: 'payload', message: 'Missing required field: payload' });
    }

    if (item.tool_name && !TOOL_NAMES.includes(item.tool_name as string)) {
      errors.push({
        itemIndex: i,
        field: 'tool_name',
        message: `Unknown tool: ${item.tool_name}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Registered dataset.
 */
export const dataset: RegisteredDataset = {
  metadata,
  generate,
  validate,
};
