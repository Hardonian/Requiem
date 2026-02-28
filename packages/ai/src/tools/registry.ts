/**
 * @fileoverview Central tool registry for the AI control-plane.
 *
 * INVARIANT: Every tool invocation MUST go through invokeToolWithPolicy.
 * INVARIANT: No "god mode" — tools without requiredCapabilities are not auto-accessible.
 * INVARIANT: Tools with tenantScoped:true MUST have a valid tenant context.
 */

import { AiError } from '../errors/AiError.js';
import { AiErrorCode } from '../errors/codes.js';
import { now } from '../types/index.js';
import type { ToolDefinition, ToolHandler, RegisteredTool, ListToolsFilter } from './types.js';

// ─── Registry State ───────────────────────────────────────────────────────────

/** In-memory tool registry keyed by `name@version` */
const _registry = new Map<string, RegisteredTool>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a tool definition + handler.
 * Throws AiError.TOOL_ALREADY_REGISTERED if the same name@version exists.
 */
export function registerTool(
  definition: ToolDefinition,
  handler: ToolHandler
): void {
  const key = toolKey(definition.name, definition.version);
  if (_registry.has(key)) {
    throw new AiError({
      code: AiErrorCode.TOOL_ALREADY_REGISTERED,
      message: `Tool already registered: ${key}`,
      phase: 'registry',
    });
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
 *
 * @param definition The tool's formal definition.
 * @param handler The function that executes the tool's logic.
 * @param tenantId The tenant owning this tool (defaults to 'system').
 */
export function registerTool<
  TInput extends z.ZodType<any>,
  TOutput extends z.ZodType<any>
>(
  definition: ToolDefinition<TInput, TOutput>,
  handler: ToolHandler<ToolDefinition<TInput, TOutput>>,
  tenantId: string = SYSTEM_TENANT
): void {
  const registry = getRegistry(tenantId);
  const key = `${definition.name}@${definition.version}`;

  if (registry.has(key)) {
    throw new Error(
      `Tool with name "${definition.name}" and version "${definition.version}" is already registered for tenant "${tenantId}".`
    );
  }

  validateDefinition(definition);

  _registry.set(key, { definition, handler, registeredAt: now() });
}

/**
 * Retrieve a registered tool. If version is omitted, returns the latest version.
 * Returns undefined if not found (callers must handle).
  registry.set(key, { definition: parsedDef, handler });
  console.log(`[ToolRegistry] Registered tool: ${key} for tenant: ${tenantId}`);
}

/**
 * Retrieves a registered tool by its name and optionally a specific version, scoped to a tenant.
 *
 * @param name The name of the tool to retrieve.
 * @param tenantId The tenant context for retrieval.
 * @param version An optional semver version string.
 * @returns The registered tool, or `undefined` if not found.
 */
export function getTool(
  name: string,
  tenantId: string = SYSTEM_TENANT,
  version?: string
): RegisteredTool | undefined {
  const registry = getRegistry(tenantId);

  if (version) {
    return _registry.get(toolKey(name, version));
  }

  let latest: RegisteredTool | undefined;
  let latestVer = '0.0.0';
  for (const [key, tool] of _registry) {
    return registry.get(`${name}@${version}`);
  }

  // Find the latest version if no specific version is requested
  let latestTool: RegisteredTool | undefined;
  let latestVersion = '0.0.0';

  for (const [key, tool] of registry.entries()) {
    if (key.startsWith(`${name}@`)) {
      if (compareVersions(tool.definition.version, latestVer) > 0) {
        latestVer = tool.definition.version;
        latest = tool;
      }
    }
  }
  return latest;
}

/**
 * List all registered tool definitions, with optional filtering.
 */
export function listTools(filter?: ListToolsFilter): ToolDefinition[] {
  let tools = Array.from(_registry.values()).map(r => r.definition);

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
 * Lists all registered tools for a specific tenant.
 *
 * @param tenantId The tenant to list tools for.
 * @returns An array of all registered tool definitions for the tenant.
 */
export function listTools(tenantId: string = SYSTEM_TENANT): ToolDefinition<any, any>[] {
  return Array.from(getRegistry(tenantId).values()).map((t) => t.definition);
}


/**
 * Invokes a tool with the given input for a specific tenant.
 *
 * THIS IS A TEMPORARY IMPLEMENTATION. In Phase 2, this will be replaced by
 * `invokeToolWithPolicy` which adds a crucial security and policy-gating layer.
 *
 * @param name The name of the tool to invoke.
 * @param input The input data for the tool.
 * @param tenantId The tenant context (defaults to 'system').
 * @returns The tool's output.
 * @throws If the tool is not found, or if input/output validation fails.
 */
export async function invokeTool<T extends z.ZodType<any>>(
  name: string,
  input: z.infer<T>,
  tenantId: string = SYSTEM_TENANT
): Promise<any> {
  const tool = getTool(name, tenantId);
  if (!tool) {
    throw new Error(`Tool "${name}" not found for tenant "${tenantId}".`);
  }

  return tools;
}

/** Clear all tools from registry (for testing only). */
export function _clearRegistry(): void {
  _registry.clear();
}

/** Get count of registered tools. */
export function getToolCount(): number {
  return _registry.size;
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

function toolKey(name: string, version: string): string {
  return `${name}@${version}`;
}

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
}

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}
