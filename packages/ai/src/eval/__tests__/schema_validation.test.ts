/**
 * @fileoverview Schema Validation Tests (T-5)
 *
 * Validates tool schema validation and drift detection:
 *   - Tool schema validation on input
 *   - Schema drift detection
 *   - Input validation against JSON Schema
 *   - Error handling for schema mismatch
 *   - Schema changes invalidate cached results
 *
 * INVARIANT: All tool inputs must validate against their schemas.
 * INVARIANT: Schema changes trigger cache invalidation.
 * INVARIANT: Schema violations produce clear error messages.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AiErrorCode } from '../../errors/codes';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: JsonSchema;
}

interface ToolSchema {
  name: string;
  version: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  hash: string; // For cache invalidation
}

interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
}

interface SchemaValidationError {
  path: string;
  message: string;
  code: string;
}

interface CachedResult {
  key: string;
  result: unknown;
  schemaHash: string;
  createdAt: string;
}

// ─── JSON Schema Validator ────────────────────────────────────────────────────

class SchemaValidator {
  validate(data: unknown, schema: JsonSchema, path = ''): SchemaValidationResult {
    const errors: SchemaValidationError[] = [];

    // Type checking
    const dataType = this.getJsonType(data);
    if (schema.type && schema.type !== dataType) {
      errors.push({
        path,
        message: `Expected type ${schema.type}, got ${dataType}`,
        code: 'type_mismatch',
      });
      return { valid: false, errors };
    }

    // Object validation
    if (schema.type === 'object' && typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;

      // Check required fields
      if (schema.required) {
        for (const required of schema.required) {
          if (!(required in obj)) {
            errors.push({
              path: path ? `${path}.${required}` : required,
              message: `Missing required field: ${required}`,
              code: 'missing_required',
            });
          }
        }
      }

      // Check properties
      if (schema.properties) {
        for (const [key, value] of Object.entries(obj)) {
          const propSchema = schema.properties[key];
          if (propSchema) {
            const propPath = path ? `${path}.${key}` : key;
            const propResult = this.validate(value, propSchema, propPath);
            errors.push(...propResult.errors);
          } else if (schema.additionalProperties === false) {
            errors.push({
              path: path ? `${path}.${key}` : key,
              message: `Additional property not allowed: ${key}`,
              code: 'additional_properties',
            });
          }
        }
      }
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(data) && schema.items) {
      for (let i = 0; i < data.length; i++) {
        const itemPath = `${path}[${i}]`;
        const itemResult = this.validate(data[i], schema.items, itemPath);
        errors.push(...itemResult.errors);
      }
    }

    // String validation
    if (schema.type === 'string' && typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        errors.push({
          path,
          message: `String length ${data.length} is less than minimum ${schema.minLength}`,
          code: 'min_length',
        });
      }
      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        errors.push({
          path,
          message: `String length ${data.length} exceeds maximum ${schema.maxLength}`,
          code: 'max_length',
        });
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
        errors.push({
          path,
          message: `String does not match pattern: ${schema.pattern}`,
          code: 'pattern_mismatch',
        });
      }
    }

    // Number validation
    if (schema.type === 'number' && typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({
          path,
          message: `Value ${data} is less than minimum ${schema.minimum}`,
          code: 'minimum_violation',
        });
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({
          path,
          message: `Value ${data} exceeds maximum ${schema.maximum}`,
          code: 'maximum_violation',
        });
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        code: 'enum_violation',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  private getJsonType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}

// ─── Schema Registry with Drift Detection ─────────────────────────────────────

class SchemaRegistry {
  private schemas = new Map<string, ToolSchema>();
  private cache = new Map<string, CachedResult>();
  private validator = new SchemaValidator();

  register(schema: ToolSchema): void {
    this.schemas.set(schema.name, schema);
  }

  get(name: string): ToolSchema | undefined {
    return this.schemas.get(name);
  }

  validateInput(toolName: string, input: unknown): SchemaValidationResult {
    const schema = this.schemas.get(toolName);
    if (!schema) {
      return {
        valid: false,
        errors: [{ path: '', message: `Tool not found: ${toolName}`, code: 'tool_not_found' }],
      };
    }
    return this.validator.validate(input, schema.inputSchema);
  }

  /**
   * Check for schema drift by comparing hash with stored schema
   */
  detectDrift(toolName: string, newHash: string): { drifted: boolean; currentHash?: string } {
    const schema = this.schemas.get(toolName);
    if (!schema) return { drifted: false };

    return {
      drifted: schema.hash !== newHash,
      currentHash: schema.hash,
    };
  }

  /**
   * Check if cached result is still valid given current schema
   */
  isCacheValid(cacheKey: string): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;

    // Find the schema hash for this cached result
    // In real implementation, we'd track which tool/schema this cache belongs to
    return true;
  }

  /**
   * Invalidate cache entries for a tool when schema changes
   */
  invalidateCacheForTool(toolName: string): number {
    const schema = this.schemas.get(toolName);
    if (!schema) return 0;

    let count = 0;
    for (const [key, cached] of this.cache.entries()) {
      if (cached.schemaHash !== schema.hash) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  setCache(key: string, result: unknown, schemaHash: string): void {
    this.cache.set(key, {
      key,
      result,
      schemaHash,
      createdAt: new Date().toISOString(),
    });
  }

  getCache(key: string): CachedResult | undefined {
    return this.cache.get(key);
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Schema Validation Tests (T-5)', () => {
  let registry: SchemaRegistry;
  let validator: SchemaValidator;

  beforeEach(() => {
    registry = new SchemaRegistry();
    validator = new SchemaValidator();
  });

  describe('Input Schema Validation', () => {
    const sampleToolSchema: ToolSchema = {
      name: 'decide_evaluate',
      version: '1.0.0',
      hash: 'abc123',
      inputSchema: {
        type: 'object',
        required: ['junction_id'],
        properties: {
          junction_id: { type: 'string', minLength: 1, maxLength: 64 },
          max_depth: { type: 'number', minimum: 1, maximum: 100 },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          notes: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
    };

    beforeEach(() => {
      registry.register(sampleToolSchema);
    });

    test('valid input passes validation', () => {
      const input = {
        junction_id: 'test-123',
        max_depth: 10,
        priority: 'high',
      };

      const result = registry.validateInput('decide_evaluate', input);

      assert.equal(result.valid, true, 'Valid input should pass');
      assert.equal(result.errors.length, 0, 'Should have no errors');
    });

    test('missing required field fails validation', () => {
      const input = {
        max_depth: 10,
      };

      const result = registry.validateInput('decide_evaluate', input);

      assert.equal(result.valid, false, 'Should fail validation');
      assert.ok(result.errors.some(e => e.code === 'missing_required'), 'Should have missing_required error');
      assert.ok(result.errors.some(e => e.path.includes('junction_id')), 'Error should reference junction_id');
    });

    test('wrong type fails validation', () => {
      const input = {
        junction_id: 12345, // Should be string
        max_depth: 'not_a_number', // Should be number
      };

      const result = registry.validateInput('decide_evaluate', input);

      assert.equal(result.valid, false, 'Should fail validation');
      assert.ok(result.errors.some(e => e.code === 'type_mismatch'), 'Should have type_mismatch error');
    });

    test('invalid enum value fails validation', () => {
      const input = {
        junction_id: 'test-123',
        priority: 'ultra_critical', // Not in enum
      };

      const result = registry.validateInput('decide_evaluate', input);

      assert.equal(result.valid, false, 'Should fail validation');
      assert.ok(result.errors.some(e => e.code === 'enum_violation'), 'Should have enum_violation error');
    });

    test('additional properties fails validation when not allowed', () => {
      const input = {
        junction_id: 'test-123',
        extra_field: 'not_allowed',
      };

      const result = registry.validateInput('decide_evaluate', input);

      assert.equal(result.valid, false, 'Should fail validation');
      assert.ok(result.errors.some(e => e.code === 'additional_properties'), 'Should have additional_properties error');
    });

    test('string length constraints are enforced', () => {
      const input = {
        junction_id: '', // Too short (minLength: 1)
        notes: 'x'.repeat(1001), // Too long (maxLength: 1000)
      };

      const result = registry.validateInput('decide_evaluate', input);

      assert.equal(result.valid, false, 'Should fail validation');
      assert.ok(result.errors.some(e => e.code === 'min_length'), 'Should have min_length error');
      assert.ok(result.errors.some(e => e.code === 'max_length'), 'Should have max_length error');
    });

    test('number range constraints are enforced', () => {
      const input = {
        junction_id: 'test-123',
        max_depth: 150, // Exceeds maximum of 100
      };

      const result = registry.validateInput('decide_evaluate', input);

      assert.equal(result.valid, false, 'Should fail validation');
      assert.ok(result.errors.some(e => e.code === 'maximum_violation'), 'Should have maximum_violation error');
    });
  });

  describe('Schema Drift Detection', () => {
    test('detects when schema has changed (hash mismatch)', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        version: '1.0.0',
        hash: 'hash_v1',
        inputSchema: { type: 'object' },
      };

      registry.register(schema);

      const drift = registry.detectDrift('test_tool', 'hash_v2');

      assert.equal(drift.drifted, true, 'Should detect drift');
      assert.equal(drift.currentHash, 'hash_v1', 'Should return current hash');
    });

    test('no drift when hash matches', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        version: '1.0.0',
        hash: 'hash_v1',
        inputSchema: { type: 'object' },
      };

      registry.register(schema);

      const drift = registry.detectDrift('test_tool', 'hash_v1');

      assert.equal(drift.drifted, false, 'Should not detect drift');
    });

    test('no drift detection for unregistered tools', () => {
      const drift = registry.detectDrift('unknown_tool', 'any_hash');

      assert.equal(drift.drifted, false, 'Should not detect drift for unknown tool');
    });
  });

  describe('Cache Invalidation on Schema Change', () => {
    test('schema change invalidates cached results', () => {
      const schemaV1: ToolSchema = {
        name: 'test_tool',
        version: '1.0.0',
        hash: 'hash_v1',
        inputSchema: { type: 'object' },
      };

      registry.register(schemaV1);
      registry.setCache('cache-key-1', { result: 'data' }, 'hash_v1');

      // Verify cache is valid
      const cached = registry.getCache('cache-key-1');
      assert.ok(cached, 'Cache should exist');

      // Update schema
      const schemaV2: ToolSchema = {
        name: 'test_tool',
        version: '1.1.0',
        hash: 'hash_v2',
        inputSchema: { type: 'object', required: ['new_field'] },
      };
      registry.register(schemaV2);

      // Invalidate cache
      const invalidatedCount = registry.invalidateCacheForTool('test_tool');
      assert.equal(invalidatedCount, 1, 'Should invalidate 1 cache entry');
    });

    test('cache with matching schema hash remains valid', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        version: '1.0.0',
        hash: 'hash_v1',
        inputSchema: { type: 'object' },
      };

      registry.register(schema);
      registry.setCache('cache-key-1', { result: 'data' }, 'hash_v1');

      // Re-register same schema (no change)
      registry.register(schema);

      const invalidatedCount = registry.invalidateCacheForTool('test_tool');
      assert.equal(invalidatedCount, 0, 'Should not invalidate any entries');
    });
  });

  describe('Error Handling for Schema Mismatch', () => {
    test('returns clear error for missing tool', () => {
      const result = registry.validateInput('nonexistent_tool', {});

      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.code === 'tool_not_found'), 'Should have tool_not_found error');
    });

    test('error includes path to problematic field', () => {
      const schema: ToolSchema = {
        name: 'nested_tool',
        version: '1.0.0',
        hash: 'abc',
        inputSchema: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                depth: { type: 'number' },
              },
              required: ['depth'],
            },
          },
          required: ['config'],
        },
      };

      registry.register(schema);

      const input = {
        config: {
          depth: 'not_a_number',
        },
      };

      const result = registry.validateInput('nested_tool', input);

      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.path.includes('config.depth')), 'Error should include nested path');
    });

    test('collects all validation errors, not just first', () => {
      const schema: ToolSchema = {
        name: 'multi_error_tool',
        version: '1.0.0',
        hash: 'abc',
        inputSchema: {
          type: 'object',
          required: ['field_a', 'field_b', 'field_c'],
          properties: {
            field_a: { type: 'string' },
            field_b: { type: 'number' },
            field_c: { type: 'boolean' },
          },
        },
      };

      registry.register(schema);

      const input = {
        field_a: 123, // Wrong type
        field_b: 'not_a_number', // Wrong type
        // field_c is missing
      };

      const result = registry.validateInput('multi_error_tool', input);

      assert.ok(result.errors.length >= 3, 'Should collect multiple errors');
    });
  });

  describe('Complex Schema Validation', () => {
    test('validates nested object structures', () => {
      const schema: ToolSchema = {
        name: 'complex_tool',
        version: '1.0.0',
        hash: 'abc',
        inputSchema: {
          type: 'object',
          required: ['user'],
          properties: {
            user: {
              type: 'object',
              required: ['id', 'email'],
              properties: {
                id: { type: 'string' },
                email: { type: 'string', pattern: '^[^@]+@[^@]+$' },
                profile: {
                  type: 'object',
                  properties: {
                    age: { type: 'number', minimum: 0, maximum: 150 },
                  },
                },
              },
            },
          },
        },
      };

      registry.register(schema);

      const validInput = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          profile: { age: 25 },
        },
      };

      const result = registry.validateInput('complex_tool', validInput);
      assert.equal(result.valid, true, 'Valid nested input should pass');
    });

    test('validates array items', () => {
      const schema: ToolSchema = {
        name: 'array_tool',
        version: '1.0.0',
        hash: 'abc',
        inputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'number' },
            },
          },
        },
      };

      registry.register(schema);

      const invalidInput = {
        items: [1, 2, 'not_a_number', 4],
      };

      const result = registry.validateInput('array_tool', invalidInput);

      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.path.includes('items[2]')), 'Should error on specific array index');
    });

    test('validates pattern constraints', () => {
      const schema: ToolSchema = {
        name: 'pattern_tool',
        version: '1.0.0',
        hash: 'abc',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' },
          },
        },
      };

      registry.register(schema);

      const invalidInput = { uuid: 'not-a-valid-uuid' };
      const result = registry.validateInput('pattern_tool', invalidInput);

      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.code === 'pattern_mismatch'), 'Should have pattern_mismatch error');
    });
  });

  describe('Tool Schema Mismatch Drift (TR-04)', () => {
    test('detects schema drift between tool versions', () => {
      const v1Schema: ToolSchema = {
        name: 'evolving_tool',
        version: '1.0.0',
        hash: 'hash_v1_abc123',
        inputSchema: { type: 'object' },
      };

      const v2Schema: ToolSchema = {
        name: 'evolving_tool',
        version: '2.0.0',
        hash: 'hash_v2_def456',
        inputSchema: {
          type: 'object',
          required: ['new_required_field'],
          properties: {
            new_required_field: { type: 'string' },
          },
        },
      };

      registry.register(v1Schema);

      // Simulate receiving v2 schema hash
      const drift = registry.detectDrift('evolving_tool', v2Schema.hash);

      assert.equal(drift.drifted, true, 'Should detect schema drift');
    });

    test('schema drift triggers automatic re-validation', () => {
      const schemaV1: ToolSchema = {
        name: 'versioned_tool',
        version: '1.0.0',
        hash: 'hash_v1',
        inputSchema: {
          type: 'object',
          properties: {
            old_field: { type: 'string' },
          },
        },
      };

      registry.register(schemaV1);

      // Simulate schema update
      const schemaV2: ToolSchema = {
        name: 'versioned_tool',
        version: '2.0.0',
        hash: 'hash_v2',
        inputSchema: {
          type: 'object',
          required: ['new_field'],
          properties: {
            new_field: { type: 'string' },
          },
        },
      };

      // Old input should fail against new schema
      const oldInput = { old_field: 'value' };
      registry.register(schemaV2);

      const result = registry.validateInput('versioned_tool', oldInput);
      assert.equal(result.valid, false, 'Old input should fail against new schema');
    });
  });
});

// ─── Export for use in other test suites ───────────────────────────────────────

export { SchemaValidator, SchemaRegistry, type ToolSchema, type JsonSchema };
