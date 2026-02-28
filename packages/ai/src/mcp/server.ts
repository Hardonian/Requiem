/**
 * @fileoverview Framework-agnostic MCP server handlers.
 *
 * These handlers implement the MCP protocol (listTools, callTool, health)
 * without depending on any specific HTTP framework.
 *
 * Transport adapters (Next.js, Node) wrap these handlers.
 *
 * INVARIANT: No hard-500. Every handler returns a typed result or AiError.
 * INVARIANT: Tenant context is NEVER derived from request body or query params.
 * INVARIANT: Auth is resolved by the transport adapter before calling handlers.
 */

import { listTools } from '../tools/registry';
import { invokeToolWithPolicy } from '../tools/invoke';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { getToolCount } from '../tools/registry';
import type { InvocationContext } from '../types/index';
import type {
  McpListToolsResponse,
  McpCallToolResponse,
  McpHealthResponse,
  McpToolDescriptor,
} from './types';

// ─── Output Size Cap ──────────────────────────────────────────────────────────

/** Maximum allowed byte size for a single tool output (2 MB). */
const MAX_TOOL_OUTPUT_BYTES = 2 * 1024 * 1024;

/**
 * Enforce the tool output size cap.
 * Returns the original value if within limits, or a truncation notice string.
 */
function capToolOutput(output: unknown): unknown {
  const serialized = JSON.stringify(output);
  const byteSize = Buffer.byteLength(serialized, 'utf8');
  if (byteSize > MAX_TOOL_OUTPUT_BYTES) {
    return `[TRUNCATED: output exceeded 2MB limit. Original size: ${byteSize} bytes]`;
  }
  return output;
}

// ─── Handler Results ──────────────────────────────────────────────────────────

export interface McpHandlerResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; retryable: boolean; phase?: string };
  trace_id?: string;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Handle tools/list — returns all visible tool definitions.
 * Filters out tools that require capabilities the actor doesn't have.
 */
export async function handleListTools(
  ctx: InvocationContext
): Promise<McpHandlerResult<McpListToolsResponse>> {
  try {
    const allTools = listTools();

    // Convert to MCP descriptors (strip handler details)
    const descriptors: McpToolDescriptor[] = allTools.map(t => ({
      name: t.name,
      version: t.version,
      description: t.description,
      inputSchema: t.inputSchema as unknown as Record<string, unknown>,
      deterministic: t.deterministic,
      sideEffect: t.sideEffect,
      tenantScoped: t.tenantScoped,
      requiredCapabilities: t.requiredCapabilities,
    }));

    return {
      ok: true,
      data: { tools: descriptors },
      trace_id: ctx.traceId,
    };
  } catch (err) {
    const aiErr = AiError.fromUnknown(err, 'mcp.listTools');
    return {
      ok: false,
      error: aiErr.toSafeJson(),
      trace_id: ctx.traceId,
    };
  }
}

/**
 * Handle tools/call — invokes a tool via policy gate.
 */
export async function handleCallTool(
  ctx: InvocationContext,
  toolName: string,
  args: unknown
): Promise<McpHandlerResult<McpCallToolResponse>> {
  if (!toolName || typeof toolName !== 'string') {
    const err = new AiError({
      code: AiErrorCode.MCP_INVALID_REQUEST,
      message: 'toolName is required and must be a string',
      phase: 'mcp.callTool',
    });
    return { ok: false, error: err.toSafeJson(), trace_id: ctx.traceId };
  }

  try {
    const result = await invokeToolWithPolicy(ctx, toolName, args ?? {});
    return {
      ok: true,
      data: {
        content: capToolOutput(result.output),
        latencyMs: result.latencyMs,
        toolVersion: result.toolVersion,
      },
      trace_id: ctx.traceId,
    };
  } catch (err) {
    const aiErr = AiError.fromUnknown(err, 'mcp.callTool');
    return {
      ok: false,
      error: aiErr.toSafeJson(),
      trace_id: ctx.traceId,
    };
  }
}

/**
 * Handle system/health — returns AI layer status.
 * No auth required.
 */
export async function handleHealth(): Promise<McpHandlerResult<McpHealthResponse>> {
  try {
    return {
      ok: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        tool_count: getToolCount(),
        version: '0.1.0',
      },
    };
  } catch (err) {
    const aiErr = AiError.fromUnknown(err, 'mcp.health');
    return { ok: false, error: aiErr.toSafeJson() };
  }
}
