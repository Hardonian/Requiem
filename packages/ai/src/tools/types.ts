/**
 * @fileoverview Core types for the tool registry system.
 */

import type { InvocationContext } from '../types/index';

// ─── JSON Schema ──────────────────────────────────────────────────────────────

/**
 * JSON Schema (subset) for tool input/output definitions.
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JsonSchema;
  $ref?: string;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
}

// ─── Tool Definition ──────────────────────────────────────────────────────────

/**
 * Cost hint for a tool — used by model arbitrator.
 */
export interface ToolCostHint {
  /** Estimated cost per invocation in USD cents */
  costCents?: number;
  /** Typical latency bucket */
  latency?: 'low' | 'medium' | 'high';
}

/**
 * Formal definition of a tool that can be registered and invoked.
 */
export interface ToolDefinition {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly outputSchema: JsonSchema;
  readonly deterministic: boolean;
  readonly sideEffect: boolean;
  readonly idempotent: boolean;
  readonly requiredCapabilities: readonly string[];
  readonly tenantScoped: boolean;
  readonly costHint?: ToolCostHint;
}

// ─── Handler + Registration ───────────────────────────────────────────────────

/**
 * Implementation function for a tool.
 * Receives validated InvocationContext and input.
 */
export type ToolHandler = (
  ctx: InvocationContext,
  input: unknown
) => Promise<unknown>;

export interface RegisteredTool {
  readonly definition: ToolDefinition;
  readonly handler: ToolHandler;
  readonly registeredAt: string;
}

// ─── Invocation Result ────────────────────────────────────────────────────────

export interface ToolInvocationResult {
  readonly output: unknown;
  readonly latencyMs: number;
  readonly toolName: string;
  readonly toolVersion: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface ToolAuditRecord {
  readonly toolName: string;
  readonly toolVersion: string;
  readonly actorId: string;
  readonly tenantId: string | null;
  readonly traceId: string;
  readonly decision: 'allow' | 'deny';
  readonly reason: string;
  readonly latencyMs: number | null;
  readonly timestamp: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface ListToolsFilter {
  capability?: string;
  tenantScoped?: boolean;
  sideEffect?: boolean;
  deterministic?: boolean;
}
