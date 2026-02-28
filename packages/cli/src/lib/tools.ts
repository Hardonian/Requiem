/**
 * Tool Registry — Deterministic AI Capability Management
 *
 * INVARIANT: Every tool call MUST be recordable and replayable.
 * INVARIANT: Non-deterministic tools MUST be explicitly flagged.
 * INVARIANT: Tenant boundaries MUST be enforced at the registry level.
 */

import { z } from 'zod';
import { TenantContext, TenantRole, hasRequiredRole } from './tenant';
import { RequiemError, ErrorCode, ErrorSeverity } from './errors';

/**
 * Metadata for tool versioning and identification.
 */
export interface ToolIdentity {
  readonly name: string;
  readonly version: string;
  readonly digest: string; // BLAKE3 digest of the tool's logic/schema
}

/**
 * Context provided to every tool handler.
 */
export interface ToolContext extends TenantContext {
  readonly requestId: string;
  readonly timestamp: string;
  readonly depth: number; // Current recursion depth
  readonly correlationId: string;
}

/**
 * Schema-validated tool definition.
 */
export interface ToolDefinition<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly inputSchema: I;
  readonly outputSchema: O;

  /** Whether the tool is deterministic (suitable for caching/replay) */
  readonly deterministic: boolean;

  /** Whether the tool modifies state */
  readonly sideEffect: boolean;

  /** Whether the tool is safe to retry */
  readonly idempotent: boolean;

  /** Capabilities required to execute this tool (RBAC) */
  readonly requiredCapabilities: string[];

  /** Whether the tool requires a tenant context to operate */
  readonly tenantScoped: boolean;

  /** BLAKE3 Digest of the tool's logic and schema contract */
  readonly digest: string;

  /** Cost and performance characteristics for arbitration */
  readonly cost?: {
    readonly costCents?: number;
    readonly latency?: 'low' | 'medium' | 'high';
  };

  /** The execution logic */
  readonly handler: (input: z.infer<I>, ctx: ToolContext) => Promise<z.infer<O>>;
}

/**
 * Registry for managing and discovering tools.
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>> = new Map();
  private static MAX_DEPTH = 10; // Global hard limit

  /**
   * Register a new tool.
   * Validates tool integrity before adding to the registry.
   */
  register<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
    tool: ToolDefinition<I, O>
  ): void {
    if (this.tools.has(tool.name)) {
      throw new RequiemError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Tool already registered: ${tool.name}`,
        severity: ErrorSeverity.CRITICAL,
      });
    }

    // Versioning & Drift Protection: Verify digest matches logic contract
    // In a real system, this would be compared against a known-good registry
    if (!tool.digest || tool.digest.length < 32) {
      throw new RequiemError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Tool ${tool.name} missing or invalid logic digest (drift protection required)`,
        severity: ErrorSeverity.CRITICAL,
      });
    }

    // TODO: Verify versioning consistency (no downgrades)
    this.tools.set(tool.name, tool);
  }

  /**
   * Call a tool with full policy enforcement.
   */
  async call(
    name: string,
    input: unknown,
    ctx: ToolContext
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new RequiemError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Tool not found: ${name}`,
        severity: ErrorSeverity.WARNING,
      });
    }

    // 1. Enforce Recursion Depth
    if (ctx.depth > ToolRegistry.MAX_DEPTH) {
      throw new RequiemError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Max recursion depth exceeded (${ctx.depth})`,
        severity: ErrorSeverity.CRITICAL,
      });
    }

    // 2. Enforce Tenant Scoping
    if (tool.tenantScoped && !ctx.tenantId) {
      throw new RequiemError({
        code: ErrorCode.UNAUTHORIZED,
        message: `Tool ${name} requires a tenant context`,
        severity: ErrorSeverity.CRITICAL,
      });
    }

    // 3. Enforce RBAC / Capability check
    // If tool specifies required capabilities, we'd check them against the user role/permissions
    // Simplified: Role-based check
    if (tool.sideEffect && !hasRequiredRole(ctx.role, TenantRole.MEMBER)) {
      throw new RequiemError({
        code: ErrorCode.FORBIDDEN,
        message: `Role ${ctx.role} lacks permission to execute side-effect tool ${name}`,
        severity: ErrorSeverity.WARNING,
      });
    }

    // 4. Validate Input Schema
    const validatedInput = await tool.inputSchema.parseAsync(input).catch((err: Error) => {
      throw new RequiemError({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Validation failed for tool ${name}: ${err.message}`,
        severity: ErrorSeverity.WARNING,
      });
    });

    // 5. Execute Handler
    const output = await tool.handler(validatedInput, ctx);

    // 6. Validate Output Schema (Ensure contract integrity)
    return await tool.outputSchema.parseAsync(output).catch((err: Error) => {
      throw new RequiemError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Tool ${name} returned invalid output: ${err.message}`,
        severity: ErrorSeverity.CRITICAL,
      });
    });
  }

  list(): ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>[] {
    return Array.from(this.tools.values());
  }

  get(name: string): ToolDefinition<z.ZodTypeAny, z.ZodTypeAny> | undefined {
    return this.tools.get(name);
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();
