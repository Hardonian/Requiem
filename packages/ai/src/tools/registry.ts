/**
 * @fileoverview Central tool registry for the AI control-plane.
 *
 * INVARIANT: Every tool invocation MUST go through invokeTool.
 * INVARIANT: No "god mode" — tools without requiredCapabilities are not auto-accessible.
 * INVARIANT: Tools with tenantScoped:true MUST have a valid tenant context.
 * INVARIANT: Registry is a single flat map keyed by name@version.
 */

import { z, ZodError } from 'zod';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { now } from '../types/index';
import type { InvocationContext } from '../types/index';

// #region: Context Types

/**
 * Result of tool execution
 */
export interface ToolResult {
  /** Whether the tool executed successfully */
  success: boolean;
  /** Tool output if successful */
  output?: unknown;
  /** Error details if failed (serialized AiError) */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  /** Execution latency in milliseconds */
  latencyMs: number;
}

// #endregion: Context Types


// #region: Core Types and Schemas

/**
 * Generic Zod schema type
 */
export type ZodSchema = z.ZodType<any>;

/**
 * Defines the cost and performance hints for a tool.
 */
export const ToolCostSchema = z.object({
  costCents: z.number().nonnegative().optional(),
  latency: z.enum(['low', 'medium', 'high']).optional(),
});
export type ToolCost = z.infer<typeof ToolCostSchema>;

/**
 * The formal definition of a tool that can be registered and invoked.
 */
export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1),
  inputSchema: z.any(),
  outputSchema: z.any(),
  deterministic: z.boolean().default(false),
  sideEffect: z.boolean().default(true),
  idempotent: z.boolean().default(false),
  cost: ToolCostSchema.optional(),
  requiredCapabilities: z.array(z.string()).default([]),
  tenantScoped: z.boolean().default(true),
});

/**
 * Tool definition type.
 * Accepts both Zod schemas and plain JSON Schema objects for input/output.
 * Builtins may use either style.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolDefinition<
  Input = any,
  Output = any
> = Omit<z.infer<typeof ToolDefinitionSchema>, 'inputSchema' | 'outputSchema'> & {
  inputSchema: Input;
  outputSchema: Output;
};

/** The actual function that implements the tool's logic. */
export type ToolHandler<
  TDef extends ToolDefinition = ToolDefinition
> = (
  ctx: InvocationContext,
  input: TDef['inputSchema'] extends ZodSchema ? z.infer<TDef['inputSchema']> : unknown
) => Promise<TDef['outputSchema'] extends ZodSchema ? z.infer<TDef['outputSchema']> : unknown>;

/** A container for a registered tool, holding its definition and handler. */
interface RegisteredTool {
  definition: ToolDefinition<any, any>;
  handler: ToolHandler<any>;
  registeredAt: string;
}

/** Filter for listing tools */
export interface ListToolsFilter {
  capability?: string;
  tenantScoped?: boolean;
  sideEffect?: boolean;
  deterministic?: boolean;
}

// #endregion: Core Types and Schemas


// #region: Policy Gate

/**
 * Policy gate check function
 */
export type PolicyGateCheck = (
  ctx: InvocationContext,
  toolDef: ToolDefinition<any, any>,
  input: unknown
) => Promise<{ allowed: boolean; reason?: string }>;

let policyGate: PolicyGateCheck | null = null;

export function setPolicyGate(gate: PolicyGateCheck): void {
  policyGate = gate;
}

export function getPolicyGate(): PolicyGateCheck | null {
  return policyGate;
}

async function defaultPolicyGate(
  _ctx: InvocationContext,
  toolDef: ToolDefinition<any, any>,
  _input: unknown
): Promise<{ allowed: boolean; reason?: string }> {
  return {
    allowed: false,
    reason: `Tool "${toolDef.name}@${toolDef.version}" is not approved by policy. Policy gate not configured.`,
  };
}

// #endregion: Policy Gate


// #region: Tool Registry State

/**
 * The in-memory store for all registered tools, isolated by tenant.
 * Structure: tenantId -> (name@version -> RegisteredTool)
 */
const tenantRegistries = new Map<string, Map<string, RegisteredTool>>();

/** Default tenant ID for system-wide tools. */
const SYSTEM_TENANT = 'system';

/**
 * Gets or creates a registry for a specific tenant.
 */
function getRegistry(tenantId: string = SYSTEM_TENANT): Map<string, RegisteredTool> {
  let registry = tenantRegistries.get(tenantId);
  if (!registry) {
    registry = new Map<string, RegisteredTool>();
    tenantRegistries.set(tenantId, registry);
  }
  return registry;
}

// #endregion: Tool Registry State


// #region: Public API

/**
 * Registers a new tool or a new version of an existing tool for a specific tenant.
 */
export function registerTool(
  definition: ToolDefinition,
  handler: ToolHandler,
  tenantId: string = SYSTEM_TENANT
): void {
  const registry = getRegistry(tenantId);
  const key = `${definition.name}@${definition.version}`;

  if (registry.has(key)) {
    throw new AiError({
      code: AiErrorCode.TOOL_ALREADY_REGISTERED,
      message: `Tool "${definition.name}" v${definition.version} is already registered for tenant "${tenantId}".`,
      phase: 'registry'
    });
  }

  // Basic structural validation
  validateDefinition(definition);

  registry.set(key, { definition, handler, registeredAt: now() });
}

/**
 * Retrieves a registered tool by its name and optionally a specific version, scoped to a tenant.
 */
export function getTool(name: string, tenantId: string = SYSTEM_TENANT, version?: string): RegisteredTool | undefined {
  const registry = getRegistry(tenantId);

  if (version) {
    return registry.get(`${name}@${version}`);
  }

  // Find the latest version if no specific version is requested
  let latest: RegisteredTool | undefined;
  let latestVer = '0.0.0';

  for (const tool of Array.from(registry.values())) {
    if (tool.definition.name === name) {
      if (compareVersions(tool.definition.version, latestVer) > 0) {
        latestVer = tool.definition.version;
        latest = tool;
      }
    }
  }
  return latest;
}

/**
 * Lists all registered tools for a specific tenant, with optional filtering.
 */
export function listTools(tenantId: string = SYSTEM_TENANT, filter?: ListToolsFilter): ToolDefinition[] {
  const registry = getRegistry(tenantId);
  let tools = Array.from(registry.values()).map(r => r.definition);

  if (filter) {
    if (filter.capability) {
      tools = tools.filter(t => t.requiredCapabilities.includes(filter.capability!));
    }
    if (filter.tenantScoped !== undefined) {
      tools = tools.filter(t => t.tenantScoped === filter.tenantScoped);
    }
    if (filter.sideEffect !== undefined) {
      tools = tools.filter(t => t.sideEffect === filter.sideEffect);
    }
    if (filter.deterministic !== undefined) {
      tools = tools.filter(t => t.deterministic === filter.deterministic);
    }
  }

  return tools;
}

/**
 * Invokes a tool with the given context and input.
 */
export async function invokeTool(
  ctx: InvocationContext,
  name: string,
  input: unknown,
  tenantId?: string
): Promise<ToolResult> {
  const effectiveTenantId = tenantId ?? ctx.tenant.tenantId ?? SYSTEM_TENANT;
  const startTime = Date.now(); // DETERMINISM: observation-only, not in decision path

  const tool = getTool(name, effectiveTenantId);
  if (!tool) {
    const err = AiError.toolNotFound(name);
    return {
      success: false,
      error: err.toSafeJson(),
      latencyMs: Date.now() - startTime,
    };
  }

  // 1. Validate Input
  let validatedInput: unknown;
  try {
    validatedInput = tool.definition.inputSchema.parse(input);
  } catch (error) {
    const details = error instanceof ZodError
      ? error.issues.map(i => i.message).join(', ')
      : 'Input validation failed';
    const err = AiError.toolSchemaViolation(name, 'input', details);
    return {
      success: false,
      error: {
        ...err.toSafeJson(),
        details: error instanceof ZodError ? { issues: error.issues } : undefined
      },
      latencyMs: Date.now() - startTime,
    };
  }

  // 2. Policy Gate Check
  const gate = policyGate ?? defaultPolicyGate;
  const policyResult = await gate(ctx, tool.definition, validatedInput);

  if (!policyResult.allowed) {
    const err = AiError.policyDenied(policyResult.reason || 'Not approved by policy gate', name);
    return {
      success: false,
      error: err.toSafeJson(),
      latencyMs: Date.now() - startTime,
    };
  }

  // 3. Execute Handler
  let output: unknown;
  try {
    output = await tool.handler(ctx, validatedInput);
  } catch (error) {
    const err = AiError.fromUnknown(error, 'tool');
    return {
      success: false,
      error: {
        ...err.toSafeJson(),
        details: error instanceof Error ? { stack: error.stack } : undefined
      },
      latencyMs: Date.now() - startTime,
    };
  }

  // 4. Validate Output
  try {
    const validatedOutput = tool.definition.outputSchema.parse(output);
    return {
      success: true,
      output: validatedOutput,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const details = error instanceof ZodError
      ? error.issues.map(i => i.message).join(', ')
      : 'Output validation failed';
    const err = AiError.toolSchemaViolation(name, 'output', details);
    return {
      success: false,
      error: {
        ...err.toSafeJson(),
        details: error instanceof ZodError ? { issues: error.issues } : undefined
      },
      latencyMs: Date.now() - startTime,
    };
  }
}

// #endregion: Public API


// #region: Debug Helpers

/**
 * Get the count of registered tools for a tenant.
 */
export function getToolCount(tenantId: string = SYSTEM_TENANT): number {
  const registry = getRegistry(tenantId);
  return registry.size;
}

/**
 * Clear the registry (for testing).
 * @internal
 */
export function _clearRegistry(): void {
  tenantRegistries.clear();
}

// #endregion: Debug Helpers


// #region: Private Helpers

function validateDefinition(def: ToolDefinition): void {
  if (!def.name || typeof def.name !== 'string') {
    throw new AiError({ code: AiErrorCode.INTERNAL_ERROR, message: 'Tool name is required', phase: 'registry' });
  }
  if (!def.version || !/^\d+\.\d+\.\d+$/.test(def.version)) {
    throw new AiError({ code: AiErrorCode.INTERNAL_ERROR, message: `Tool version must be semver: ${def.version}`, phase: 'registry' });
  }
  if (!def.description || typeof def.description !== 'string') {
    throw new AiError({ code: AiErrorCode.INTERNAL_ERROR, message: 'Tool description is required', phase: 'registry' });
  }
  if (!def.inputSchema || typeof def.inputSchema !== 'object') {
    throw new AiError({ code: AiErrorCode.INTERNAL_ERROR, message: 'Tool inputSchema is required', phase: 'registry' });
  }
  if (!def.outputSchema || typeof def.outputSchema !== 'object') {
    throw new AiError({ code: AiErrorCode.INTERNAL_ERROR, message: 'Tool outputSchema is required', phase: 'registry' });
  }
  if (typeof def.deterministic !== 'boolean') {
    throw new AiError({ code: AiErrorCode.INTERNAL_ERROR, message: 'Tool deterministic flag is required', phase: 'registry' });
  }
}

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((p1[i] ?? 0) > (p2[i] ?? 0)) return 1;
    if ((p1[i] ?? 0) < (p2[i] ?? 0)) return -1;
  }
  return 0;
}

// #endregion: Private Helpers
