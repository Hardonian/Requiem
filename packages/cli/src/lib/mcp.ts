/**
 * MCP Server Implementation — Requiem Stdio Bridge
 *
 * Standardized interface for model interaction with Requiem tools.
 */

import { toolRegistry } from './tools';
import { AgentRunner, AgentRunState } from './agent-runner';
import { TenantContext } from './tenant';
import { RequiemError, ErrorCode, ErrorSeverity } from './errors';

export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: any;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Handles incoming MCP messages from an LLM.
 * Each request is executed within a managed AgentRunner session.
 */
export class McpServer {
  private runner: AgentRunner;
  private state: AgentRunState;

  constructor(context: TenantContext & { requestId: string }) {
    this.runner = new AgentRunner(context);
    this.state = this.runner.createInitialState();
  }

  /**
   * Process a single MCP request
   */
  async handleRequest(request: McpRequest): Promise<McpResponse> {
    try {
      switch (request.method) {
        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: toolRegistry.list().map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema, // Note: Simplified, normally converts Zod to JSON Schema
                version: t.version,
              })),
            },
          };

        case 'tools/call':
          const { name, arguments: args } = request.params;

          // Increment depth for the agentic loop
          this.runner.incrementDepth(this.state);

          const result = await this.runner.executeTool(name, args, this.state);

          return {
            jsonrpc: '2.0',
            id: request.id,
            result,
          };

        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`,
            },
          };
      }
    } catch (err) {
      const error = RequiemError.fromUnknown(err);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: this.mapErrorCodeToMcp(error.code),
          message: error.message,
          data: error.toEnvelope(),
        },
      };
    }
  }

  private mapErrorCodeToMcp(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.UNAUTHORIZED: return -32001;
      case ErrorCode.FORBIDDEN: return -32003;
      case ErrorCode.VALIDATION_FAILED: return -32602;
      case ErrorCode.INTERNAL_ERROR: return -32603;
      default: return -32000;
    }
  }
}
