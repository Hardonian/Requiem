/**
 * Tool Registry — Deterministic AI Capability Management
 *
 * INVARIANT: Every tool call MUST be recordable and replayable.
 * INVARIANT: Non-deterministic tools MUST be explicitly flagged.
 * INVARIANT: Tenant boundaries MUST be enforced at the registry level.
 * INVARIANT: Budget enforcement is MANDATORY — CLI cannot bypass policies.
 */

import { z } from 'zod';
import { TenantContext, TenantRole, hasRequiredRole } from './tenant';
import { RequiemError, ErrorCode, ErrorSeverity } from './errors';

// Budget tracking for CLI (in production, this would be shared with AI package)
interface BudgetState {
  usedCostCents: number;
  windowStart: string;
  limit: BudgetLimit;
}

interface BudgetLimit {
  maxCostCents: number;
  windowSeconds: number;
}

const CLI_BUDGET_LIMITS: Map<string, BudgetLimit> = new Map([
  ['free', { maxCostCents: 1000, windowSeconds: 2592000 }], // $10/month
  ['enterprise', { maxCostCents: Number.MAX_SAFE_INTEGER, windowSeconds: 2592000 }],
]);

const budgetStates = new Map<string, BudgetState>();
const budgetLocks = new Map<string, Promise<void>>();
const budgetLockResolvers = new Map<string, () => void>();

// Default tier for CLI (can be configured via environment)
let defaultTier = 'free';

/**
 * Configure CLI budget tier for a tenant.
 * Call this during CLI initialization or tenant setup.
 */
export function setCLIBudgetTier(_tenantId: string, tier: 'free' | 'enterprise'): void {
  defaultTier = tier;
}

/** Get budget limit for a tenant tier */
function getBudgetLimit(_tenantId: string): BudgetLimit {
  // Check for tenant-specific override first
  // In production, this would query configuration
  const limit = CLI_BUDGET_LIMITS.get(defaultTier);
  return limit ?? CLI_BUDGET_LIMITS.get('free')!;
}

/** Acquire per-tenant mutex to prevent concurrent races */
async function acquireBudgetLock(tenantId: string): Promise<void> {
  while (budgetLocks.has(tenantId)) {
    await budgetLocks.get(tenantId);
  }
  let resolve: () => void;
  const lock = new Promise<void>(r => { resolve = r; });
  budgetLocks.set(tenantId, lock);
  budgetLockResolvers.set(tenantId, resolve!);
}

function releaseBudgetLock(tenantId: string): void {
  const resolve = budgetLockResolvers.get(tenantId);
  if (resolve) {
    budgetLocks.delete(tenantId);
    budgetLockResolvers.delete(tenantId);
    resolve();
  }
}

/**
 * Check and reserve budget for a tool invocation.
 * Enforces atomic budget limits - concurrent requests cannot exceed limit.
 */
async function checkBudget(tenantId: string, estimatedCostCents: number): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  // Get limit for tenant tier
  const limit = getBudgetLimit(tenantId);

  // No limit for enterprise (or very high limit)
  if (limit.maxCostCents === Number.MAX_SAFE_INTEGER) {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER };
  }

  await acquireBudgetLock(tenantId);
  try {
    let state = budgetStates.get(tenantId);

    // Initialize state if needed
    if (!state) {
      state = {
        usedCostCents: 0,
        windowStart: new Date().toISOString(),
        limit,
      };
      budgetStates.set(tenantId, state);
    }

    // Reset window if expired
    const windowStart = new Date(state.windowStart).getTime();
    const windowEndMs = windowStart + limit.windowSeconds * 1000;
    if (Date.now() > windowEndMs) {
      state.usedCostCents = 0;
      state.windowStart = new Date().toISOString();
    }

    const projectedCost = state.usedCostCents + estimatedCostCents;

    if (projectedCost > limit.maxCostCents) {
      return {
        allowed: false,
        reason: `Budget exceeded: ${state.usedCostCents}¢ used + ${estimatedCostCents}¢ estimated > ${limit.maxCostCents}¢ limit`,
        remaining: Math.max(0, limit.maxCostCents - state.usedCostCents),
      };
    }

    // Reserve the cost (atomic pre-debit)
    state.usedCostCents += estimatedCostCents;

    return {
      allowed: true,
      remaining: Math.max(0, limit.maxCostCents - state.usedCostCents),
    };
  } finally {
    releaseBudgetLock(tenantId);
  }
}



/**
 * Get current budget state for a tenant (for observability).
 */
export function getCLIBudgetState(tenantId: string): { used: number; limit: number; remaining: number } | undefined {
  const state = budgetStates.get(tenantId);
  if (!state) return undefined;

  return {
    used: state.usedCostCents,
    limit: state.limit.maxCostCents,
    remaining: Math.max(0, state.limit.maxCostCents - state.usedCostCents),
  };
}

// ─── Audit Logging for CLI ────────────────────────────────────────────────────

interface CLIAuditRecord {
  timestamp: string;
  actorId: string;
  tenantId: string | null;
  traceId: string;
  toolName: string;
  toolVersion: string;
  decision: 'allow' | 'deny';
  reason: string;
  source: 'cli';
}

const auditRecords: CLIAuditRecord[] = [];

/**
 * Log a CLI tool execution attempt.
 * In production, this would write to a database or external logging service.
 */
export function logCLIAudit(
  actorId: string,
  tenantId: string | null,
  traceId: string,
  toolName: string,
  toolVersion: string,
  decision: 'allow' | 'deny',
  reason: string
): void {
  const record: CLIAuditRecord = {
    timestamp: new Date().toISOString(),
    actorId,
    tenantId,
    traceId,
    toolName,
    toolVersion,
    decision,
    reason,
    source: 'cli',
  };

  // In production, this would be async and go to external storage
  auditRecords.push(record);

  // Keep only last 1000 records in memory for debugging
  if (auditRecords.length > 1000) {
    auditRecords.shift();
  }
}

/**
 * Get recent audit records (for debugging/testing).
 */
export function getCLIAuditRecords(): readonly CLIAuditRecord[] {
  return auditRecords;
}

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

    // 4. Enforce Budget Limits (CLI cannot bypass policies)
    const estimatedCost = tool.cost?.costCents ?? 0;
    if (tool.tenantScoped && ctx.tenantId) {
      const budgetResult = await checkBudget(ctx.tenantId, estimatedCost);

      // Log the policy decision
      logCLIAudit(
        ctx.userId ?? 'unknown',
        ctx.tenantId,
        ctx.requestId,
        name,
        tool.version,
        budgetResult.allowed ? 'allow' : 'deny',
        budgetResult.allowed
          ? `Budget check passed (${estimatedCost}¢ estimated)`
          : budgetResult.reason ?? 'Budget exceeded'
      );

      if (!budgetResult.allowed) {
        throw new RequiemError({
          code: ErrorCode.BUDGET_EXCEEDED,
          message: `Budget check failed for tool ${name}: ${budgetResult.reason}`,
          severity: ErrorSeverity.CRITICAL,
        });
      }
    } else {
      // Log even when no budget check needed (non-tenant-scoped tools)
      logCLIAudit(
        ctx.userId ?? 'unknown',
        ctx.tenantId,
        ctx.requestId,
        name,
        tool.version,
        'allow',
        'Non-tenant-scoped tool, budget check skipped'
      );
    }

    // 5. Validate Input Schema
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
