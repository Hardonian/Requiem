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

/**
 * Enhanced audit record for policy decisions.
 * 
 * INVARIANT: All policy decisions MUST be logged.
 * INVARIANT: Audit records are immutable - never modify after creation.
 * INVARIANT: Input is never logged - only its hash for identification.
 */
export interface ToolAuditRecord {
  /** Timestamp of the policy decision */
  readonly timestamp: string;
  /** Principal (actor) making the request */
  readonly actorId: string;
  /** Tenant context (null for system-wide operations) */
  readonly tenantId: string | null;
  /** Trace ID for distributed tracing */
  readonly traceId: string;
  /** Action attempted - tool name */
  readonly toolName: string;
  /** Tool version at time of decision */
  readonly toolVersion: string;
  /** SHA-256 hash of input (for audit identification, not full input) */
  readonly inputHash?: string;
  /** Policy decision */
  readonly decision: 'allow' | 'deny';
  /** Human-readable reason for decision */
  readonly reason: string;
  /** Policy rule ID that triggered this decision (for compliance) */
  readonly policyRuleId?: string;
  /** Budget information at time of decision */
  readonly budget?: {
    readonly estimatedCostCents: number;
    readonly limitCents: number;
    readonly remainingCents: number;
    readonly tier: string;
  };
  /** Execution latency (null if denied before execution) */
  readonly latencyMs: number | null;
  /** Source of the request (api, cli, mcp, internal) */
  readonly source?: 'api' | 'cli' | 'mcp' | 'internal';
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
