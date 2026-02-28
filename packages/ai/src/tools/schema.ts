/**
 * JSON Schema Validation
 * 
 * Provides validation for tool inputs and outputs using Zod.
 * Throws structured errors with code "TOOL_SCHEMA_VIOLATION".
 */

import { ZodError, ZodSchema, ZodIssueCode } from 'zod';
import type { ToolDefinition, ValidationResult, ValidationError } from './types.js';

/**
 * Error code for schema violations
 */
export const TOOL_SCHEMA_VIOLATION = 'TOOL_SCHEMA_VIOLATION';

/**
 * Schema validation error with structured details
 */
export interface SchemaViolationError extends Error {
  code: typeof TOOL_SCHEMA_VIOLATION;
  toolName: string;
  validationErrors: ValidationError[];
  isSchemaViolation: true;
}

/**
 * Creates a schema violation error
 */
function createSchemaViolationError(
  toolName: string,
  errors: ValidationError[]
): SchemaViolationError {
  const message = `Tool "${toolName}" schema validation failed: ${errors.map(e => e.message).join(', ')}`;
  
  const error = new Error(message) as SchemaViolationError;
  error.code = TOOL_SCHEMA_VIOLATION;
  error.toolName = toolName;
  error.validationErrors = errors;
  error.isSchemaViolation = true;
  
  return error;
}

/**
 * Converts Zod validation issues to our ValidationError format
 */
function convertZodIssues(issues: ZodError['issues']): ValidationError[] {
  return issues.map(issue => {
    const path = issue.path.join('.') || 'root';
    
    let message: string;
    let expected: unknown;
    let actual: unknown;
    
    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        message = `Expected ${issue.expected}, received ${issue.received}`;
        expected = issue.expected;
        actual = issue.received;
        break;
      case ZodIssueCode.invalid_enum:
        message = `Value must be one of: ${issue.options.join(', ')}`;
        expected = issue.options;
        actual = issue.received;
        break;
      case ZodIssueCode.unexpected_enum_value:
        message = `Invalid enum value. Must be one of: ${issue.options.join(', ')}`;
        expected = issue.options;
        actual = issue.received;
        break;
      case ZodIssueCode.invalid_literal:
        message = `Invalid literal value, expected ${JSON.stringify(issue.expected)}`;
        expected = issue.expected;
        break;
      case ZodIssueCode.minimum:
        message = `Value must be >= ${issue.minimum}`;
        expected = issue.minimum;
        break;
      case ZodIssueCode.maximum:
        message = `Value must be <= ${issue.maximum}`;
        expected = issue.maximum;
        break;
      case ZodIssueCode.too_small:
        message = issue.inclusive 
          ? `Array must have at least ${issue.minimum} items`
          : `Array must have more than ${issue.minimum} items`;
        expected = issue.minimum;
        break;
      case ZodIssueCode.too_big:
        message = issue.inclusive 
          ? `Array must have at most ${issue.maximum} items`
          : `Array must have less than ${issue.maximum} items`;
        expected = issue.maximum;
        break;
      case ZodIssueCode.string_too_short:
        message = `String must have at least ${issue.minimum} characters`;
        expected = issue.minimum;
        break;
      case ZodIssueCode.string_too_long:
        message = `String must have at most ${issue.maximum} characters`;
        expected = issue.maximum;
        break;
      case ZodIssueCode.custom:
        message = issue.message || 'Custom validation failed';
        break;
      case ZodIssueCode.invalid_date:
        message = 'Invalid date format';
        break;
      case ZodIssueCode.missing_keys:
        message = `Missing required keys: ${issue.keys.join(', ')}`;
        expected = issue.keys;
        break;
      case ZodIssueCode.unrecognized_keys:
        message = `Unrecognized keys: ${issue.keys.join(', ')}`;
        actual = issue.keys;
        break;
      case ZodIssueCode.not_multiple_of:
        message = `Value must be a multiple of ${issue.multipleOf}`;
        expected = issue.multipleOf;
        break;
      default:
        message = issue.message || 'Validation failed';
    }
    
    return { path, message, expected, actual };
  });
}

/**
 * Validates input against a tool's input schema
 * 
 * @param toolDef - The tool definition with input schema
 * @param input - The input to validate
 * @returns ValidationResult indicating success or failure
 * @throws SchemaViolationError if validation fails
 */
export function validateInput(toolDef: ToolDefinition, input: unknown): ValidationResult {
  try {
    // Create a Zod schema from the tool definition
    // Note: In production, you would convert the JSONSchema to Zod schema
    // For now, we do basic validation
    const schema = createZodSchema(toolDef.inputSchema as any);
    schema.parse(input);
    
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = convertZodIssues(error.issues);
      return { valid: false, errors };
    }
    // Re-throw non-Zod errors
    throw error;
  }
}

/**
 * Validates output against a tool's output schema
 * 
 * @param toolDef - The tool definition with output schema
 * @param output - The output to validate
 * @returns ValidationResult indicating success or failure
 * @throws SchemaViolationError if validation fails
 */
export function validateOutput(toolDef: ToolDefinition, output: unknown): ValidationResult {
  try {
    const schema = createZodSchema(toolDef.outputSchema as any);
    schema.parse(output);
    
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = convertZodIssues(error.issues);
      return { valid: false, errors };
    }
    throw error;
  }
}

/**
 * Validates input and throws SchemaViolationError on failure
 * 
 * @param toolDef - The tool definition with input schema
 * @param input - The input to validate
 * @throws SchemaViolationError if validation fails
 */
export function validateInputOrThrow(toolDef: ToolDefinition, input: unknown): void {
  const result = validateInput(toolDef, input);
  if (!result.valid) {
    throw createSchemaViolationError(toolDef.name, result.errors);
  }
}

/**
 * Validates output and throws SchemaViolationError on failure
 * 
 * @param toolDef - The tool definition with output schema
 * @param output - The output to validate
 * @throws SchemaViolationError if validation fails
 */
export function validateOutputOrThrow(toolDef: ToolDefinition, output: unknown): void {
  const result = validateOutput(toolDef, output);
  if (!result.valid) {
    throw createSchemaViolationError(toolDef.name, result.errors);
  }
}

/**
 * Creates a basic Zod schema from a JSON schema-like object
 * This is a simplified implementation - in production you'd use
 * a proper JSON Schema to Zod converter
 */
function createZodSchema(schema: Record<string, unknown>): ZodSchema {
  // For now, return a passthrough schema
  // In production, implement proper JSON Schema to Zod conversion
  const { z } = require('zod');
  
  if (!schema || typeof schema !== 'object') {
    return z.any();
  }
  
  const type = schema.type;
  
  if (type === 'object') {
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = schema.required as string[] | undefined;
    
    if (!properties) {
      return z.record(z.string(), z.any());
    }
    
    const shape: Record<string, ZodSchema> = {};
    for (const [key, propSchema] of Object.entries(properties)) {
      shape[key] = createZodSchema(propSchema);
    }
    
    return z.object(shape, { required: required || [] });
  }
  
  if (type === 'array') {
    const items = schema.items as Record<string, unknown> | undefined;
    return items ? z.array(createZodSchema(items)) : z.array(z.any());
  }
  
  if (type === 'string') {
    return z.string();
  }
  
  if (type === 'number' || type === 'integer') {
    return z.number();
  }
  
  if (type === 'boolean') {
    return z.boolean();
  }
  
  if (type === 'null') {
    return z.null();
  }
  
  return z.any();
}

/**
 * Checks if an error is a schema violation error
 */
export function isSchemaViolationError(error: unknown): error is SchemaViolationError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'isSchemaViolation' in error &&
    (error as any).isSchemaViolation === true
  );
}

/**
 * Gets a safe error message for user display
 * (does not expose internal stack traces)
 */
export function getSafeErrorMessage(error: unknown): string {
  if (isSchemaViolationError(error)) {
    return `Schema validation failed for tool "${error.toolName}": ${error.validationErrors.map(e => e.message).join('; ')}`;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unknown error occurred';
}
