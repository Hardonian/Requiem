/**
 * @fileoverview MCP protocol types.
 *
 * Minimal type definitions for the Model Context Protocol.
 * These follow the MCP spec conventions but are simplified for this scaffold.
 */

// ─── Request/Response ─────────────────────────────────────────────────────────

export interface McpListToolsRequest {
  method: 'tools/list';
  params?: Record<string, unknown>;
}

export interface McpCallToolRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface McpHealthRequest {
  method: 'system/health';
  params?: Record<string, unknown>;
}

export type McpRequest = McpListToolsRequest | McpCallToolRequest | McpHealthRequest;

// ─── Tool Descriptors ─────────────────────────────────────────────────────────

/**
 * Tool descriptor as exposed via MCP listTools.
 * Intentionally limited — no handler details, no internal schema.
 */
export interface McpToolDescriptor {
  name: string;
  version: string;
  description: string;
  inputSchema: Record<string, unknown>;
  deterministic: boolean;
  sideEffect: boolean;
  tenantScoped: boolean;
  requiredCapabilities: readonly string[];
}

// ─── Responses ────────────────────────────────────────────────────────────────

export interface McpListToolsResponse {
  tools: McpToolDescriptor[];
}

export interface McpCallToolResponse {
  content: unknown;
  latencyMs: number;
  toolVersion: string;
}

export interface McpHealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  tool_count: number;
  version: string;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export interface McpError {
  code: string;
  message: string;
  retryable: boolean;
}
