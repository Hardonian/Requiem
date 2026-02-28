/**
 * @fileoverview A structured, policy-aware tool registry for AI agents.
 *
 * This module provides a centralized system for defining, registering, and invoking
 * tools that AI agents can use. It ensures that all tool interactions are
 * schema-validated, policy-gated, and auditable.
 *
 * Key principles:
 * - **Schema-First:** Every tool must have a JSON schema for its inputs and outputs.
 * - **Safety by Default:** Tools are assumed to have side effects and be non-deterministic
 *   unless explicitly marked otherwise.
 * - **Policy Gating:** Tool invocation is always checked against a policy layer before execution.
 * - **Versioning:** Tools are versioned to allow for safe evolution.
 * - **Auditable:** All tool invocations are logged with a structured context.
 */

import { z } from 'zod';

// #region: Core Types and Schemas

/**
 * Defines the cost and performance hints for a tool.
 * This helps the model arbitrator make better decisions.
 */
export const ToolCostSchema = z.object({
  /** Estimated cost per invocation in USD cents. */
  costCents: z.number().nonnegative().optional(),
  /** Typical latency bucket. */
  latency: z.enum(['low', 'medium', 'high']).optional(),
});
export type ToolCost = z.infer<typeof ToolCostSchema>;

/**
 * The formal definition of a tool that can be registered and invoked.
 */
export const ToolDefinitionSchema = z.object({
  /** The unique name of the tool, e.g., "run_shell_command". */
  name: z.string().min(1),
  /**
   * The semantic version of the tool.
   * @example "1.0.0"
   */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** A clear, concise description of what the tool does, for both humans and LLMs. */
  description: z.string().min(1),
  /**
   * A Zod schema defining the shape and types of the tool's input.
   * This is used for validation before execution.
   */
  inputSchema: z.ZodType<any>,
  /**
   * A Zod schema defining the shape and types of the tool's output.
   * This is used for validating the result after execution.
   */
  outputSchema: z.ZodType<any>,
  /**
   * Whether the tool produces the same output for the same input every time.
   * @default false
   */
  deterministic: z.boolean().default(false),
  /**
   * Whether the tool changes state outside of its return value (e.g., writes to a file).
   * @default true
   */
  sideEffect: z.boolean().default(true),
  /**
   * Whether the tool can be safely called multiple times with the same input
   * without changing the outcome.
   * @default false
   */
  idempotent: z.boolean().default(false),
  /** Cost and performance hints for the model arbitrator. */
  cost: ToolCostSchema.optional(),
  /**
   * The capabilities required by the actor to invoke this tool (for RBAC).
   * @example ["file:write", "shell:exec"]
   */
  requiredCapabilities: z.array(z.string()).default([]),
  /**
   * If true, this tool can only be invoked within a valid tenant context.
   * @default true
   */
  tenantScoped: z.boolean().default(true),
});
export type ToolDefinition<
  Input extends z.ZodType<any> = z.ZodType<any>,
  Output extends z.ZodType<any> = z.ZodType<any>
> = Omit<z.infer<typeof ToolDefinitionSchema>, 'inputSchema' | 'outputSchema'> & {
  inputSchema: Input;
  outputSchema: Output;
};


/** The actual function that implements the tool's logic. */
export type ToolHandler<
  TDef extends ToolDefinition<any, any>
> = (
  // ctx: InvocationContext, // Will be defined in Phase 2
  input: z.infer<TDef['inputSchema']>
) => Promise<z.infer<TDef['outputSchema']>>;

/** A container for a registered tool, holding its definition and handler. */
interface RegisteredTool {
  definition: ToolDefinition<any, any>;
  handler: ToolHandler<any>;
}

// #endregion: Core Types and Schemas


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
 * Registers a new tool or a new version of an existing tool.
 *
 * @param definition The tool's formal definition, validated against the schema.
 * @param handler The function that executes the tool's logic.
 * @throws If a tool with the same name and version is already registered.
 */
export function registerTool<
  TInput extends z.ZodType<any>,
  TOutput extends z.ZodType<any>
>(
  definition: ToolDefinition<TInput, TOutput>,
  handler: ToolHandler<ToolDefinition<TInput, TOutput>>
): void {
  const key = `${definition.name}@${definition.version}`;
  if (toolRegistry.has(key)) {
    throw new Error(
      `Tool with name "${definition.name}" and version "${definition.version}" is already registered.`
    );
  }

  // Validate the definition itself
  const parsedDef = ToolDefinitionSchema.parse(definition);

  toolRegistry.set(key, { definition: parsedDef, handler });
  console.log(`[ToolRegistry] Registered tool: ${key}`);
}

/**
 * Retrieves a registered tool by its name and optionally a specific version.
 *
 * @param name The name of the tool to retrieve.
 * @param version An optional semver version string. If omitted, the latest version is returned.
 * @returns The registered tool, or `undefined` if not found.
 */
export function getTool(name: string, version?: string): RegisteredTool | undefined {
  if (version) {
    return toolRegistry.get(`${name}@${version}`);
  }

  // Find the latest version if no specific version is requested
  let latestTool: RegisteredTool | undefined;
  let latestVersion = '0.0.0';

  for (const [key, tool] of toolRegistry.entries()) {
    if (key.startsWith(`${name}@`)) {
      if (compareVersions(tool.definition.version, latestVersion) > 0) {
        latestVersion = tool.definition.version;
        latestTool = tool;
      }
    }
  }
  return latestTool;
}

/**
 * Lists all registered tools, optionally filtering by name.
 *
 * @returns An array of all registered tool definitions.
 */
export function listTools(): ToolDefinition<any, any>[] {
  return Array.from(toolRegistry.values()).map((t) => t.definition);
}


/**
 * Invokes a tool with the given input.
 *
 * THIS IS A TEMPORARY IMPLEMENTATION. In Phase 2, this will be replaced by
 * `invokeToolWithPolicy` which adds a crucial security and policy-gating layer.
 *
 * @param name The name of the tool to invoke.
 * @param input The input data for the tool.
 * @returns The tool's output.
 * @throws If the tool is not found, or if input/output validation fails.
 */
export async function invokeTool<T extends z.ZodType<any>>(
  // ctx: InvocationContext,
  name: string,
  input: z.infer<T>
): Promise<any> {
  const tool = getTool(name);
  if (!tool) {
    throw new Error(`Tool "${name}" not found.`);
  }

  // 1. Validate Input
  const validatedInput = tool.definition.inputSchema.parse(input);

  // 2. Execute Handler
  const output = await tool.handler(validatedInput);

  // 3. Validate Output
  const validatedOutput = tool.definition.outputSchema.parse(output);

  return validatedOutput;
}


// #endregion: Public API


// #region: Private Helpers

/**
 * A simple semver comparator.
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}

// #endregion: Private Helpers
