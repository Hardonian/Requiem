/**
 * AI Tools Registry
 * 
 * Provides a simple in-memory tool registry for CLI use.
 * This is a simplified version that doesn't require cross-package imports.
 */

import { z } from 'zod';

// Types
export interface ToolDefinition<
  Input extends ZodSchema = ZodSchema,
  Output extends ZodSchema = ZodSchema
> {
  name: string;
  version: string;
  description: string;
  inputSchema: Input;
  outputSchema: Output;
  deterministic: boolean;
  sideEffect: boolean;
  idempotent: boolean;
  requiredCapabilities: string[];
  tenantScoped: boolean;
  cost?: {
    costCents?: number;
    latency?: 'low' | 'medium' | 'high';
  };
}

export type ZodSchema = z.ZodType<unknown>;

export type ToolHandler<_TDef extends ToolDefinition<any, any>> = (
  _ctx: InvocationContext,
  input: unknown
) => Promise<unknown>;

export interface InvocationContext {
  tenantId: string;
  actorId: string;
  requestId: string;
  traceId?: string;
  capabilities: string[];
  environment: 'development' | 'production';
}

export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  latencyMs: number;
}

export interface ToolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type PolicyGateCheck = (
  ctx: InvocationContext,
  toolDef: ToolDefinition<any, any>,
  input: unknown
) => Promise<{ allowed: boolean; reason?: string }>;

// Registry state
interface RegisteredTool {
  definition: ToolDefinition<any, any>;
  handler: ToolHandler<any>;
}

const toolRegistry = new Map<string, RegisteredTool>();
let policyGate: PolicyGateCheck | null = null;

/**
 * Sets the policy gate function
 */
export function setPolicyGate(gate: PolicyGateCheck): void {
  policyGate = gate;
}

/**
 * Gets the current policy gate
 */
export function getPolicyGate(): PolicyGateCheck | null {
  return policyGate;
}

/**
 * Registers a tool
 */
export function registerTool<
  Input extends ZodSchema,
  Output extends ZodSchema
>(
  definition: ToolDefinition<Input, Output>,
  handler: ToolHandler<ToolDefinition<Input, Output>>
): void {
  const key = `${definition.name}@${definition.version}`;
  toolRegistry.set(key, { definition, handler });
  console.log(`[ToolRegistry] Registered tool: ${key}`);
}

/**
 * Gets a tool by name
 */
export function getTool(
  name: string,
  _tenantId: string = 'system',
  version?: string
): RegisteredTool | undefined {
  const key = version ? `${name}@${version}` : name;
  
  // Try exact match first
  if (toolRegistry.has(key)) {
    return toolRegistry.get(key);
  }
  
  // Try finding latest version
  if (!version) {
    let latest: RegisteredTool | undefined;
    let latestVersion = '0.0.0';
    
    for (const [k, tool] of toolRegistry.entries()) {
      if (k.startsWith(`${name}@`)) {
        const v = k.replace(`${name}@`, '');
        if (compareVersions(v, latestVersion) > 0) {
          latestVersion = v;
          latest = tool;
        }
      }
    }
    return latest;
  }
  
  return undefined;
}

/**
 * Lists all registered tools
 */
export function listTools(_tenantId: string = 'system'): ToolDefinition<any, any>[] {
  return Array.from(toolRegistry.values()).map((t) => t.definition);
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}

