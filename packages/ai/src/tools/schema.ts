/**
<<<<<<< HEAD
 * @fileoverview JSON Schema validation for tool inputs/outputs.
 * Uses lightweight structural validation against JsonSchema definitions.
 * Raises AiError.TOOL_SCHEMA_VIOLATION on failure.
 */

import { AiError } from '../errors/AiError.js';
import type { ToolDefinition, ValidationResult, ValidationError, JsonSchema } from './types.js';

/**
 * Validates a value against a JSON Schema definition.
 * Returns structured errors — does NOT throw.
 */
function validateAgainstSchema(
  schema: JsonSchema,
  value: unknown,
  path: string = ''
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const valid = types.includes(actualType) ||
      (types.includes('integer') && typeof value === 'number' && Number.isInteger(value));
    if (!valid) {
      errors.push({
        path: path || 'root',
        message: `Expected type ${types.join('|')}, got ${actualType}`,
        expected: schema.type,
        actual: actualType,
      });
      return errors; // Type mismatch — stop further checks
    }
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push({
      path: path || 'root',
      message: `Value must be one of: ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`,
      expected: schema.enum,
      actual: value,
    });
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path: path || 'root', message: `String must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path: path || 'root', message: `String must be at most ${schema.maxLength} characters` });
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path: path || 'root', message: `Value must be >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path: path || 'root', message: `Value must be <= ${schema.maximum}` });
    }
  }

  if (schema.type === 'object' || (typeof value === 'object' && value !== null && !Array.isArray(value))) {
    const obj = value as Record<string, unknown>;
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push({
            path: path ? `${path}.${key}` : key,
            message: `Missing required field: ${key}`,
          });
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          errors.push(...validateAgainstSchema(propSchema, obj[key], path ? `${path}.${key}` : key));
        }
      }
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, idx) => {
      errors.push(...validateAgainstSchema(schema.items!, item, `${path}[${idx}]`));
    });
  }

  return errors;
}

/**
 * Validates tool input against its schema.
 * Returns ValidationResult (does not throw).
 */
export function validateInput(toolDef: ToolDefinition, input: unknown): ValidationResult {
  const errors = validateAgainstSchema(toolDef.inputSchema, input);
  return { valid: errors.length === 0, errors };
}

/**
 * Validates tool output against its schema.
 * Returns ValidationResult (does not throw).
 */
export function validateOutput(toolDef: ToolDefinition, output: unknown): ValidationResult {
  const errors = validateAgainstSchema(toolDef.outputSchema, output);
  return { valid: errors.length === 0, errors };
}

/**
 * Validates input, throws AiError on failure.
 */
export function validateInputOrThrow(toolDef: ToolDefinition, input: unknown): void {
  const result = validateInput(toolDef, input);
  if (!result.valid) {
    throw AiError.toolSchemaViolation(toolDef.name, 'input', result.errors.map(e => e.message).join('; '));
  }
}

/**
 * Validates output, throws AiError on failure.
 */
export function validateOutputOrThrow(toolDef: ToolDefinition, output: unknown): void {
  const result = validateOutput(toolDef, output);
  if (!result.valid) {
    throw AiError.toolSchemaViolation(toolDef.name, 'output', result.errors.map(e => e.message).join('; '));
  }
}

/** Check if an error is an AiError with TOOL_SCHEMA_VIOLATION code. */
export function isSchemaViolationError(error: unknown): boolean {
  return error instanceof AiError && error.code === 'AI_TOOL_SCHEMA_VIOLATION';
}
=======
 * JSON Schema
>>>>>>> 7d8226b (docs: document the Model Context Protocol (MCP) for tool registry, definition, and invocation.)
