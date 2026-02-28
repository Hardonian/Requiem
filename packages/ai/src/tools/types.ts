/**
 * Tool Registry Types
 * 
 * Core type definitions for the tool registry system.
 * These types define the contract for AI-accessible tools.
 */

import type { JSONSchemaType } from 'zod';

/**
 * Environment context for tool execution
 */
export type Environment = 'development' | 'production';

/**
 * Context passed to every tool invocation
 */
export interface ToolContext {
  /** The tenant ID for multi-tenant isolation */
  tenantId: string;
  /** The actor ID (user or agent) making the request */
  actorId: string;
  /** Unique request ID for tracing */
  requestId: string;
  /** RBAC capabilities granted to the actor */
  capabilities: string[];
  /** Execution environment */
  environment: Environment;
}

/**
 * Result of tool execution
 */
export interface ToolResult {
  /** Whether the tool executed successfully */
  success: boolean;
  /** Tool output if successful */
  output?: unknown;
  /** Error details if failed */
  error?: ToolError;
  /** Execution latency in milliseconds */
  latencyMs: number;
}

/**
 * Structured error from tool execution
 */
export interface ToolError {
  /** Machine-readable error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Handler function for tool execution
 */
export type ToolHandler = (
  ctx: ToolContext,
  input: unknown
) => Promise<unknown>;

/**
 * JSON Schema type for tool definitions
 * Using Zod's JSONSchemaType for full type inference
 */
export type JsonSchema = JSONSchemaType<unknown>;

/**
 * Tool definition with full metadata
 */
export interface ToolDefinition {
  /** Unique identifier for the tool */
  name: string;
  /** Semantic version string (e.g., "1.0.0") */
  version: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for input validation */
  inputSchema: JsonSchema;
  /** JSON Schema for output validation */
  outputSchema: JsonSchema;
  /** Whether tool produces deterministic output */
  deterministic: boolean;
  /** Whether tool has side effects */
  sideEffect: boolean;
  /** Whether tool is idempotent */
  idempotent: boolean;
  /** Optional cost estimate hint */
  costHint?: string;
  /** RBAC capabilities required to use this tool */
  requiredCapabilities: string[];
  /** Whether tool is scoped to tenant (default: true) */
  tenantScoped: boolean;
}

/**
 * Registered tool with handler
 */
export interface RegisteredTool extends ToolDefinition {
  /** The handler function */
  handler: ToolHandler;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
}

/**
 * Individual validation error
 */
export interface ValidationError {
  /** JSON path to the error */
  path: string;
  /** Error message */
  message: string;
  /** Expected schema value */
  expected?: unknown;
  /** Actual value that failed */
  actual?: unknown;
}

/**
 * Tool invocation options
 */
export interface InvokeOptions {
  /** Whether to validate input before execution */
  validateInput?: boolean;
  /** Whether to validate output after execution */
  validateOutput?: boolean;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Tool registration options
 */
export interface RegisterOptions {
  /** Whether to allow overwriting existing tool */
  allowOverwrite?: boolean;
}

/**
 * List tools filter
 */
export interface ListToolsFilter {
  /** Filter by capability requirement */
  capability?: string;
  /** Filter by tenant scope */
  tenantScoped?: boolean;
  /** Filter by side effect status */
  sideEffect?: boolean;
  /** Filter by determinism */
  deterministic?: boolean;
}
