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
  }

  validateDefinition(definition);

  _registry.set(key, { definition, handler, registeredAt: now() });
}

/**
 * Retrieve a registered tool. If version is omitted, returns the latest version.
 * Returns undefined if not found (callers must handle).
 */
export function getTool(name: string, version?: string): RegisteredTool | undefined {
  if (version) {
    return _registry.get(toolKey(name, version));
  }

  let latest: RegisteredTool | undefined;
  let latestVer = '0.0.0';
  for (const [key, tool] of _registry) {
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
