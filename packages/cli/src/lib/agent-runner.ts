/**
 * Agent Runner — Execution & Policy Enforcement
 *
 * Manages the lifecycle of an agentic reasoning loop.
 * Enforces hard recursion limits and tenant isolation.
 */

import { TenantContext } from './tenant';
import { ToolContext, toolRegistry } from './tools';
import { RequiemError, ErrorCode, ErrorSeverity } from './errors';
import { hash } from './hash';

export interface AgentStep {
  tool: string;
  input: unknown;
  output?: unknown;
  error?: string;
}

export interface AgentRunState {
  trace: AgentStep[];
  depth: number;
}

export class AgentRunner {
  private static MAX_RECURSION_DEPTH = 10;

  constructor(private context: TenantContext & { requestId: string }) {}

  /**
   * Execute a tool call as part of an agentic loop.
   * Tracks depth and maintains the execution trace.
   */
  async executeTool(
    name: string,
    input: unknown,
    state: AgentRunState
  ): Promise<unknown> {
    // 1. Enforce Hard Recursion Ceiling
    if (state.depth >= AgentRunner.MAX_RECURSION_DEPTH) {
      const error = `Max recursion depth (${AgentRunner.MAX_RECURSION_DEPTH}) reached at tool ${name}`;
      state.trace.push({ tool: name, input, error });
      throw new RequiemError({
        code: ErrorCode.INTERNAL_ERROR,
        message: error,
        severity: ErrorSeverity.CRITICAL,
      });
    }

    // 2. Prepare Tool Context (Tenant Injection)
    const toolContext: ToolContext = {
      ...this.context,
      timestamp: new Date().toISOString(),
      depth: state.depth,
      correlationId: hash(`${this.context.requestId}:${state.depth}`),
    };

    // 3. Execution Phase
    try {
      const output = await toolRegistry.call(name, input, toolContext);

      // 4. Record Trace (for audit and replayer)
      state.trace.push({
        tool: name,
        input,
        output,
      });

      return output;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      state.trace.push({
        tool: name,
        input,
        error: errorMessage,
      });
      throw err;
    }
  }

  /**
   * Starts a new agentic session.
   */
  createInitialState(): AgentRunState {
    return {
      trace: [],
      depth: 0,
    };
  }

  /**
   * Updates state for the next step in the loop.
   */
  incrementDepth(state: AgentRunState): void {
    state.depth++;
  }
}
