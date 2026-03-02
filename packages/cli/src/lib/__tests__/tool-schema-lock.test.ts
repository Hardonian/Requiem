/**
 * Tests for Tool Schema Lock (Differentiator A)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeSchemaId,
  createSchemaSnapshot,
  detectSchemaDrift,
  validateAgainstSchema,
  validateToolIO,
  generateSchemaFromExamples,
  type ToolSchema,
} from '../tool-schema-lock.js';

describe('Tool Schema Lock', () => {
  const mockSchema: ToolSchema = {
    version: '1.0.0',
    toolName: 'test-tool',
    inputSchema: {
      type: 'object',
      required: ['message'],
      properties: {
        message: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string' },
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
    },
  };

  describe('computeSchemaId', () => {
    it('should compute consistent IDs for same schema', () => {
      const id1 = computeSchemaId(mockSchema);
      const id2 = computeSchemaId(mockSchema);

      expect(id1).toBe(id2);
      expect(id1).toHaveLength(64); // BLAKE3 hex hash
    });

    it('should compute different IDs for different schemas', () => {
      const schema2 = { ...mockSchema, toolName: 'different-tool' };
      const id1 = computeSchemaId(mockSchema);
      const id2 = computeSchemaId(schema2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('createSchemaSnapshot', () => {
    it('should create snapshot with ID and canonical', () => {
      const snapshot = createSchemaSnapshot(mockSchema);

      expect(snapshot.id).toBeDefined();
      expect(snapshot.canonical).toBeDefined();
      expect(snapshot.schema).toBe(mockSchema);
    });
  });

  describe('detectSchemaDrift', () => {
    it('should detect no drift for identical schemas', () => {
      const snapshot = createSchemaSnapshot(mockSchema);
      const result = detectSchemaDrift('test-tool', mockSchema, snapshot.id);

      expect(result.hasDrift).toBe(false);
      expect(result.driftType).toBe('none');
    });

    it('should detect drift for different schemas', () => {
      const snapshot = createSchemaSnapshot(mockSchema);
      const changedSchema: ToolSchema = {
        ...mockSchema,
        inputSchema: {
          type: 'object',
          required: ['message', 'newField'],
          properties: {
            message: { type: 'string' },
            newField: { type: 'number' },
          },
        },
      };

      const result = detectSchemaDrift('test-tool', changedSchema, snapshot.id);

      expect(result.hasDrift).toBe(true);
      expect(result.driftType).not.toBe('none');
    });

    it('should handle missing binding', () => {
      const result = detectSchemaDrift('test-tool', mockSchema, undefined);

      expect(result.hasDrift).toBe(false);
      expect(result.driftType).toBe('missing');
    });

    it('should assess compatibility', () => {
      const snapshot = createSchemaSnapshot(mockSchema);
      const result = detectSchemaDrift('test-tool', mockSchema, snapshot.id);

      expect(result.compatibility).toBe('compatible');
    });
  });

  describe('validateAgainstSchema', () => {
    it('should pass valid input', () => {
      const input = { message: 'hello' };
      const errors = validateAgainstSchema(input, mockSchema.inputSchema);

      expect(errors).toHaveLength(0);
    });

    it('should fail missing required field', () => {
      const input = {};
      const errors = validateAgainstSchema(input, mockSchema.inputSchema);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('message');
    });

    it('should pass when no schema provided', () => {
      const input = { anything: 'goes' };
      const errors = validateAgainstSchema(input, undefined);

      expect(errors).toHaveLength(0);
    });

    it('should validate nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              value: { type: 'string' },
            },
          },
        },
      };

      const input = { nested: { value: 123 } };
      const errors = validateAgainstSchema(input, schema);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('generateSchemaFromExamples', () => {
    it('should generate schema from examples', () => {
      const examples = [
        { name: 'test', count: 5 },
        { name: 'another', count: 10 },
      ];

      const schema = generateSchemaFromExamples(examples, 'test-tool');

      expect(schema.toolName).toBe('test-tool');
      expect(schema.inputSchema?.type).toBe('object');
    });

    it('should handle empty examples', () => {
      const schema = generateSchemaFromExamples([], 'test-tool');

      expect(schema.toolName).toBe('test-tool');
      expect(schema.inputSchema).toBeUndefined();
    });

    it('should include examples in metadata', () => {
      const examples = [{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }];
      const schema = generateSchemaFromExamples(examples, 'test-tool');

      // Should only include first 3 examples
      expect(schema.metadata.examples).toHaveLength(3);
    });
  });

  describe('determinism', () => {
    it('should produce consistent schema IDs', () => {
      const id1 = computeSchemaId(mockSchema);
      const id2 = computeSchemaId(mockSchema);
      const id3 = computeSchemaId(mockSchema);

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });

    it('should produce consistent validation results', () => {
      const input = { message: 'test' };

      const errors1 = validateAgainstSchema(input, mockSchema.inputSchema);
      const errors2 = validateAgainstSchema(input, mockSchema.inputSchema);

      expect(errors1).toEqual(errors2);
    });
  });
});
