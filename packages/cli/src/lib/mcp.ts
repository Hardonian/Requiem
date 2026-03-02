/**
 * MCP Server Implementation — Requiem Stdio Bridge
 *
 * Standardized interface for model interaction with Requiem tools.
 */

import { toolRegistry } from './tools.js';
import { AgentRunner, AgentRunState } from './agent-runner.js';
import { TenantContext } from './tenant.js';
import { RequiemError, ErrorCode } from './errors.js';
import { DecisionRepository } from '../db/decisions.js';
import { hash } from './hash.js';

export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: unknown;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Handles incoming MCP messages from an LLM.
 * Each request is executed within a managed AgentRunner session.
 */
export class McpServer {
  private runner: AgentRunner;
  private state: AgentRunState;
  private context: TenantContext & { requestId: string };

  constructor(context: TenantContext & { requestId: string }) {
    this.context = context;
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

        case 'tools/call': {
          const { name, arguments: args } = request.params as { name: string; arguments: Record<string, unknown> };

          // Increment depth for the agentic loop
          this.runner.incrementDepth(this.state);

          const startTime = Date.now();
          const result = await this.runner.executeTool(name, args, this.state);
          const latency = Date.now() - startTime;

          // Audit the tool call (Authority Sync)
          try {
            const usage = (result as any)?.usage || { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 };
            DecisionRepository.create({
              tenant_id: this.context.tenantId,
              source_type: 'mcp_tool',
              source_ref: name,
              input_fingerprint: hash(JSON.stringify(args)),
              decision_input: args,
              decision_output: result as Record<string, unknown>,
              usage,
              status: 'evaluated',
              decision_trace: this.state.trace,
              execution_latency: latency
            });
          } catch (auditErr) {
            console.error('Failed to audit tool call:', auditErr);
          }

          return {
            jsonrpc: '2.0',
            id: request.id,
            result,
          };
        }

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

