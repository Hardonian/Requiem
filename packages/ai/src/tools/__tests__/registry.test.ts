/**
 * @fileoverview Tests for new tool registry methods.
 *
 * Tests for getToolVersion, getToolDigest, isToolDeterministic, 
 * isToolIdempotent, validateToolSchema, and new ToolDefinition fields.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { registerTool, getTool, getToolVersion, getToolDigest, isToolDeterministic, isToolIdempotent, getToolOutputMaxBytes, validateToolSchema, _clearRegistry, DEFAULT_OUTPUT_MAX_BYTES } from '../registry';
import { ToolDefinitionSchema } from '../registry';

describe('Tool Registry - New Methods', () => {
  afterEach(() => {
    _clearRegistry();
  });

  describe('getToolVersion', () => {
    it('should return version for registered tool', () => {
      const toolDef = {
        name: 'testTool',
        version: '1.2.3',
        description: 'A test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        deterministic: true,
        idempotent: true,
        sideEffect: false,
        requiredCapabilities: [],
        tenantScoped: true,
      };

      registerTool(toolDef as any, async () => ({}));

      expect(getToolVersion('testTool')).toBe('1.2.3');
    });

    it('should return undefined for non-existent tool', () => {
      expect(getToolVersion('nonexistent')).toBeUndefined();
    });
  });

  describe('getToolDigest', () => {
    it('should return digest when set', () => {
      const toolDef = {
        name: 'testTool',
        version: '1.0.0',
        description: 'A test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        deterministic: true,
        idempotent: false,
        sideEffect: false,
        requiredCapabilities: [],
        tenantScoped: true,
        digest: 'abc123digest',
      };

      registerTool(toolDef as any, async () => ({}));

      expect(getToolDigest('testTool')).toBe('abc123digest');
    });

    it('should return undefined when digest not set', () => {
      const toolDef = {
        name: 'testTool',
        version: '1.0.0',
        description: 'A test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        deterministic: true,
        idempotent: false,
        sideEffect: false,
        requiredCapabilities: [],
        tenantScoped: true,
      };

      registerTool(toolDef as any, async () => ({}));

      expect(getToolDigest('testTool')).toBeUndefined();
    });
  });

  describe('isToolDeterministic', () => {
    it('should return true for deterministic tool', () => {
      const toolDef = {
        name: 'readTool',
        version: '1.0.0',
        description: 'A read-only tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        deterministic: true,
        idempotent: true,
        sideEffect: false,
        requiredCapabilities: [],
        tenantScoped: true,
      };

      registerTool(toolDef as any, async () => ({}));

      expect(isToolDeterministic('readTool')).toBe(true);
    });

    it('should return false for non-deterministic tool', () => {
      const toolDef = {
        name: 'writeTool',
        version: '1.0.0',
        description: 'A write tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        deterministic: false,
        idempotent: false,
        sideEffect: true,
        requiredCapabilities: [],
        tenantScoped: true,
      };

      registerTool(toolDef as any, async () => ({}));

      expect(isToolDeterministic('writeTool')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      expect(isToolDeterministic('nonexistent')).toBe(false);
    });
  });

  describe('isToolIdempotent', () => {
    it('should return true for idempotent tool', () => {
      const toolDef = {
        name: 'setTool',
        version: '1.0.0',
        description: 'A set tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        deterministic: true,
        idempotent: true,
        sideEffect: false,
        requiredCapabilities: [],
        tenantScoped: true,
      };

      registerTool(toolDef as any, async () => ({}));

      expect(isToolIdempotent('setTool')).toBe(true);
    });

    it('should return false for non-idempotent tool', () => {
      const toolDef = {
        name: 'appendTool',
        version: '1.0.0',
        description: 'An append tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        deterministic: false,
        idempotent: false,
        sideEffect: true,
        requiredCapabilities: [],
        tenantScoped: true,
      };

      registerTool(toolDef as any, async () => ({}));

      expect(isToolIdempotent('appendTool')).toBe(false);
    });
  });

  describe('getToolOutputMaxBytes', () => {
    it('should return custom outputMaxBytes when set', () => {
      const toolDef = {
        name: 'testTool',
        version: '1.0.0',
        description: 'A test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        deterministic: false,
        idempotent: false,
        sideEffect: false,
        requiredCapabilities: [],
        tenantScoped: true,
        outputMaxBytes: 500000,
      };

      registerTool(toolDef as any, async () => ({}));

      expect(getToolOutputMaxBytes('testTool')).toBe(500000);
    });

    it('should return default when not set', () => {
      const toolDef = {
        name: 'testTool',
        version: '1.0.0',
        description: 'A test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        deterministic: false,
        idempotent: false,
        sideEffect: false,
        requiredCapabilities: [],
        tenantScoped: true,
      };

      registerTool(toolDef as any, async () => ({}));

      expect(getToolOutputMaxBytes('testTool')).toBe(DEFAULT_OUTPUT_MAX_BYTES);
    });
  });

  describe('validateToolSchema', () => {
    it('should validate valid input', () => {
      const tool = {
        name: 'testTool',
        version: '1.0.0',
        description: 'A test tool',
        inputSchema: z.object({
          name: z.string().min(1),
          age: z.number().min(0),
        }),
        outputSchema: z.object({}),
        deterministic: false,
        idempotent: false,
        sideEffect: false,
        requiredCapabilities: [],
        tenantScoped: true,
      };

      const result = validateToolSchema(tool as any, { name: 'John', age: 30 });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid input', () => {
      const tool = {
        name: 'testTool',
        version: '1.0.0',
        description: 'A test tool',
        inputSchema: z.object({
          name: z.string().min(1),
          age: z.number().min(0),
        }),
        outputSchema: z.object({}),
        deterministic: false,
        idempotent: false,
        sideEffect: false,
        requiredCapabilities: [],
        tenantScoped: true,
      };

      const result = validateToolSchema(tool as any, { name: '', age: -5 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('ToolDefinitionSchema', () => {
  it('should accept digest field', () => {
    const result = ToolDefinitionSchema.safeParse({
      name: 'testTool',
      version: '1.0.0',
      description: 'A test tool',
      inputSchema: {},
      outputSchema: {},
      deterministic: false,
      idempotent: false,
      sideEffect: false,
      requiredCapabilities: [],
      tenantScoped: true,
      digest: 'abc123',
    });

    expect(result.success).toBe(true);
  });

  it('should accept outputMaxBytes field', () => {
    const result = ToolDefinitionSchema.safeParse({
      name: 'testTool',
      version: '1.0.0',
      description: 'A test tool',
      inputSchema: {},
      outputSchema: {},
      deterministic: false,
      idempotent: false,
      sideEffect: false,
      requiredCapabilities: [],
      tenantScoped: true,
      outputMaxBytes: 500000,
    });

    expect(result.success).toBe(true);
  });

  it('should accept both digest and outputMaxBytes', () => {
    const result = ToolDefinitionSchema.safeParse({
      name: 'testTool',
      version: '1.0.0',
      description: 'A test tool',
      inputSchema: {},
      outputSchema: {},
      deterministic: true,
      idempotent: true,
      sideEffect: false,
      requiredCapabilities: [],
      tenantScoped: true,
      digest: 'def456',
      outputMaxBytes: 1000000,
    });

    expect(result.success).toBe(true);
  });
});
