/**
 * @fileoverview Budget enforcement interface for AI operations.
 *
 * Budget checking is an INTERFACE now; real enforcement (DB-backed limits)
 * is wired up by the application layer. The scaffold returns "no limit" by default.
 *
 * INVARIANT: Budget checks happen BEFORE tool execution in the policy gate.
 * INVARIANT: Budget checks are tenant-scoped — never cross-tenant.
 */

// ─── Budget Types ──────────────────────────────────────────────────────────────

export interface BudgetLimit {
  /** Max cost in USD cents per time window */
  maxCostCents: number;
  /** Max tokens per time window */
  maxTokens?: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface BudgetState {
  tenantId: string;
  usedCostCents: number;
  usedTokens: number;
  windowStart: string;
  limit: BudgetLimit;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: {
    costCents: number;
    tokens?: number;
  };
}

// ─── Budget Checker Interface ─────────────────────────────────────────────────

/**
 * Interface that application code must implement to enforce real budget limits.
 * The DefaultBudgetChecker (below) is a pass-through for scaffolding.
 */
export interface BudgetChecker {
  /**
   * Check if a tenant has budget remaining for an operation.
   * @param tenantId - The tenant to check
   * @param estimatedCostCents - Estimated cost of the operation in USD cents
   */
  check(tenantId: string, estimatedCostCents: number): Promise<BudgetCheckResult>;
}

// ─── Default: No-Op Budget Checker ───────────────────────────────────────────

/**
 * Default budget checker that always allows operations.
 * Replace with a real implementation for production cost controls.
 *
 * TODO: Wire to ai_cost_records table for real enforcement.
 */
export class DefaultBudgetChecker implements BudgetChecker {
  async check(_tenantId: string, _estimatedCostCents: number): Promise<BudgetCheckResult> {
    // Scaffold: no budget limits enforced
    return {
      allowed: true,
      reason: 'No budget limits configured (scaffold mode)',
    };
  }
}

/** Global budget checker instance */
let _budgetChecker: BudgetChecker = new DefaultBudgetChecker();

export function setBudgetChecker(checker: BudgetChecker): void {
  _budgetChecker = checker;
}

export function getBudgetChecker(): BudgetChecker {
  return _budgetChecker;
}
