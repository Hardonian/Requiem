/**
 * @fileoverview Central tool registry for the AI control-plane.
 *
 * INVARIANT: Every tool invocation MUST go through invokeTool.
 * INVARIANT: No "god mode" — tools without requiredCapabilities are not auto-accessible.
 * INVARIANT: Tools with tenantScoped:true MUST have a valid tenant context.
 * INVARIANT: Registry is a single flat map keyed by name@version.
 */

import { AiError } from '../errors/AiError.js';
import { AiErrorCode } from '../errors/codes.js';
import { now } from '../types/index.js';
import type { ToolDefinition, ToolHandler, RegisteredTool, ListToolsFilter } from './types.js';

// #region: Tool Registry State

const SYSTEM_TENANT = 'system';

const tenantRegistries = new Map<string, Map<string, RegisteredTool>>();

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
      phase: 'registry',
    });
  }

  validateDefinition(definition);
  registry.set(key, { definition, handler, registeredAt: now() });
}

/**
 * Retrieves a registered tool by name and optionally a specific version.
 * If version is omitted, returns the latest version.
 * Returns undefined if not found (callers must handle).
 */
export function getTool(
  name: string,
  version?: string,
  tenantId: string = SYSTEM_TENANT
): RegisteredTool | undefined {
  const registry = getRegistry(tenantId);

  if (version) {
    return registry.get(`${name}@${version}`);
  }

  let latest: RegisteredTool | undefined;
  let latestVer = '0.0.0';

  for (const tool of registry.values()) {
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
export function listTools(
  filter?: ListToolsFilter,
  tenantId: string = SYSTEM_TENANT
): ToolDefinition[] {
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
 * Get the count of registered tools for a tenant.
 */
export function getToolCount(tenantId: string = SYSTEM_TENANT): number {
  return getRegistry(tenantId).size;
}

/**
 * Clear the registry (for testing).
 * @internal
 */
export function _clearRegistry(): void {
  tenantRegistries.clear();
}

// #endregion: Public API


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
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

// #endregion: Private Helpers
