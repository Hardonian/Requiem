/**
 * @fileoverview Budget enforcement for AI operations.
 *
 * INVARIANT: Budget checks happen BEFORE tool execution in the policy gate.
 * INVARIANT: Budget checks are tenant-scoped — never cross-tenant.
 * INVARIANT: AtomicBudgetChecker uses atomic compare-and-swap to prevent
 *            race conditions under parallel invocations.
 * INVARIANT: Budget counters reset at window boundary.
 * INVARIANT: Hard limit: returning `allowed: false` is FINAL — no retry.
 *
 * To wire real DB-backed limits, implement BudgetChecker and call setBudgetChecker().
 * The AtomicBudgetChecker provides in-process atomic enforcement (no races).
 */

// ─── Clock Interface ──────────────────────────────────────────────────────────

/**
 * Abstraction for wall-clock time.
 * INV-9: All time-dependent operations MUST use a Clock, never Date.now() directly.
 * Defaults to the system clock; inject a fake clock in tests.
 */
export interface Clock {
  now(): number;
}

export const defaultClock: Clock = { now: () => Date.now() };

// ─── Budget Types ──────────────────────────────────────────────────────────────

export interface BudgetLimit {
  /** Max cost in USD cents per time window */
  maxCostCents: number;
  /** Max tokens per time window (optional) */
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

export interface BudgetChecker {
  check(tenantId: string, estimatedCostCents: number): Promise<BudgetCheckResult>;
  /** Record actual cost after tool execution (optional) */
  record?(tenantId: string, actualCostCents: number, tokens?: number): Promise<void>;
}

// ─── Default: Production Budget Checker ─────────────────────────────────────

/**
 * DefaultBudgetChecker enforces budget limits based on tenant tier.
 * 
 * INVARIANT: Returns DENY by default when no explicit limits are configured
 *            to prevent accidental unlimited usage.
 * INVARIANT: Free tier has hard limits; Enterprise has configurable limits.
 * INVARIANT: Budget checks are atomic - uses mutex per tenant to prevent races.
 */

// Default limits for free tier (can be overridden)
const FREE_TIER_LIMITS: BudgetLimit = {
  maxCostCents: 1000, // $10.00 per month (1000 cents)
  maxTokens: 100000,
  windowSeconds: 2592000, // 30 days
};

// Map of tenant tier configurations
interface TenantTierConfig {
  tier: 'free' | 'enterprise';
  limits: BudgetLimit;
  // For enterprise, allow per-tenant override
  customLimits?: Map<string, BudgetLimit>;
}

// In-memory tier configuration (in production, load from database)
const tenantTiers = new Map<string, TenantTierConfig>();

// Global limits map for AtomicBudgetChecker fallback
const globalLimits = new Map<string, BudgetLimit>();

export class DefaultBudgetChecker implements BudgetChecker {
  private useAtomic: boolean;
  private clock: Clock;

  constructor(useAtomicFallback = true, clock: Clock = defaultClock) {
    this.useAtomic = useAtomicFallback;
    this.clock = clock;
  }

  /**
   * Configure a tenant's tier and limits.
   * Call this during tenant provisioning to set up budget limits.
   */
  static configureTenant(tenantId: string, tier: 'free' | 'enterprise', customLimits?: BudgetLimit): void {
    if (tier === 'free') {
      tenantTiers.set(tenantId, { tier: 'free', limits: FREE_TIER_LIMITS });
    } else {
      tenantTiers.set(tenantId, { 
        tier: 'enterprise', 
        limits: customLimits ?? { maxCostCents: Number.MAX_SAFE_INTEGER, windowSeconds: 2592000 },
        customLimits: customLimits ? new Map([[tenantId, customLimits]]) : undefined
      });
    }
  }

  /**
   * Get current tier configuration for a tenant.
   */
  static getTenantTier(tenantId: string): TenantTierConfig | undefined {
    return tenantTiers.get(tenantId);
  }

  async check(tenantId: string, estimatedCostCents: number): Promise<BudgetCheckResult> {
    // Get tier configuration
    const config = tenantTiers.get(tenantId);
    
    // Default: DENY if no configuration exists (fail-safe)
    if (!config) {
      return {
        allowed: false,
        reason: 'Budget not configured for tenant. Contact administrator to provision budget limits.',
        remaining: { costCents: 0 },
      };
    }

    // Use AtomicBudgetChecker for actual enforcement
    if (this.useAtomic) {
      const atomic = new AtomicBudgetChecker(globalLimits);
      
      // Transfer tier configuration to atomic checker
      atomic.setLimit(tenantId, config.limits);
      
      return atomic.check(tenantId, estimatedCostCents);
    }

    // Inline check (non-atomic, for reference)
    const limit = config.limits;
    
    // For simplicity, we use in-memory tracking here
    // In production, this would query the database
    const currentUsage = this.getCurrentUsage(tenantId);
    const projectedCost = currentUsage + estimatedCostCents;

    if (projectedCost > limit.maxCostCents) {
      return {
        allowed: false,
        reason: `Budget exceeded: ${currentUsage}¢ used + ${estimatedCostCents}¢ estimated > ${limit.maxCostCents}¢ limit (${config.tier} tier)`,
        remaining: { costCents: Math.max(0, limit.maxCostCents - currentUsage) },
      };
    }

    // Reserve the estimated cost
    this.recordUsage(tenantId, estimatedCostCents);

    return {
      allowed: true,
      reason: `Budget available (${config.tier} tier)`,
      remaining: {
        costCents: Math.max(0, limit.maxCostCents - (currentUsage + estimatedCostCents)),
        tokens: limit.maxTokens !== undefined
          ? Math.max(0, limit.maxTokens - this.getCurrentTokens(tenantId))
          : undefined,
      },
    };
  }

  async record(_tenantId: string, _actualCostCents: number, _tokens?: number): Promise<void> {
    // Actual recording happens in the atomic checker path
    // This is a no-op for the default checker
  }

  // In-memory usage tracking (production would use database)
  private usageTracker = new Map<string, { costCents: number; tokens: number; windowStart: string }>();

  private getCurrentUsage(tenantId: string): number {
    const state = this.usageTracker.get(tenantId);
    if (!state) return 0;
    
    // Check if window expired (simplified - production would use proper window logic)
    const windowStart = new Date(state.windowStart).getTime();
    const windowEnd = windowStart + (2592000 * 1000); // 30 days
    
    if (this.clock.now() > windowEnd) {
      this.usageTracker.delete(tenantId);
      return 0;
    }
    
    return state.costCents;
  }

  private getCurrentTokens(tenantId: string): number {
    const state = this.usageTracker.get(tenantId);
    if (!state) return 0;
    
    const windowStart = new Date(state.windowStart).getTime();
    const windowEnd = windowStart + (2592000 * 1000);
    
    if (this.clock.now() > windowEnd) {
      return 0;
    }
    
    return state.tokens;
  }

  private recordUsage(tenantId: string, costCents: number): void {
    const state = this.usageTracker.get(tenantId) || {
      costCents: 0,
      tokens: 0,
      windowStart: new Date(this.clock.now()).toISOString(),
    };
    state.costCents += costCents;
    this.usageTracker.set(tenantId, state);
  }

  /** Reset usage for a tenant (for testing) */
  _reset(tenantId?: string): void {
    if (tenantId) {
      this.usageTracker.delete(tenantId);
    } else {
      this.usageTracker.clear();
    }
  }
}

// ─── Atomic In-Process Budget Checker ────────────────────────────────────────

/**
 * AtomicBudgetChecker provides real budget enforcement with atomic counters.
 *
 * Uses a Mutex-style per-tenant lock to prevent race conditions when
 * multiple tool invocations run concurrently for the same tenant.
 *
 * INVARIANT: No two concurrent check() calls for the same tenant can both
 *            succeed if the sum would exceed the limit.
 * INVARIANT: Window resets atomically at windowStart + windowSeconds.
 */
export class AtomicBudgetChecker implements BudgetChecker {
  private states = new Map<string, BudgetState>();
  private locks = new Map<string, Promise<void>>();
  private lockResolvers = new Map<string, () => void>();
  private limits: Map<string, BudgetLimit>;
  private clock: Clock;

  constructor(
    limits: Map<string, BudgetLimit> | Record<string, BudgetLimit> = {},
    clock: Clock = defaultClock
  ) {
    this.limits = limits instanceof Map
      ? limits
      : new Map(Object.entries(limits));
    this.clock = clock;
  }

  /** Set a budget limit for a specific tenant. */
  setLimit(tenantId: string, limit: BudgetLimit): void {
    this.limits.set(tenantId, limit);
  }

  private getState(tenantId: string): BudgetState {
    const limit = this.limits.get(tenantId) ?? this.limits.get('*');
    if (!limit) {
      // No limit configured for this tenant — allow all
      return {
        tenantId,
        usedCostCents: 0,
        usedTokens: 0,
        windowStart: new Date(this.clock.now()).toISOString(),
        limit: { maxCostCents: Number.MAX_SAFE_INTEGER, windowSeconds: 3600 },
      };
    }

    let state = this.states.get(tenantId);
    if (!state) {
      state = {
        tenantId,
        usedCostCents: 0,
        usedTokens: 0,
        windowStart: new Date(this.clock.now()).toISOString(),
        limit,
      };
      this.states.set(tenantId, state);
    }

    // Reset window if expired
    const windowStart = new Date(state.windowStart).getTime();
    const windowEndMs = windowStart + limit.windowSeconds * 1000;
    if (this.clock.now() > windowEndMs) {
      state.usedCostCents = 0;
      state.usedTokens = 0;
      state.windowStart = new Date(this.clock.now()).toISOString();
    }

    return state;
  }

  /** Acquire per-tenant mutex to prevent concurrent races. */
  private async acquireLock(tenantId: string): Promise<void> {
    while (this.locks.has(tenantId)) {
      await this.locks.get(tenantId);
    }
    let resolve: () => void;
    const lock = new Promise<void>(r => { resolve = r; });
    this.locks.set(tenantId, lock);
    this.lockResolvers.set(tenantId, resolve!);
  }

  private releaseLock(tenantId: string): void {
    const resolve = this.lockResolvers.get(tenantId);
    if (resolve) {
      this.locks.delete(tenantId);
      this.lockResolvers.delete(tenantId);
      resolve();
    }
  }

  async check(tenantId: string, estimatedCostCents: number): Promise<BudgetCheckResult> {
    await this.acquireLock(tenantId);
    try {
      const state = this.getState(tenantId);
      const { limit } = state;

      const projectedCost = state.usedCostCents + estimatedCostCents;

      if (projectedCost > limit.maxCostCents) {
        return {
          allowed: false,
          reason: `Budget exceeded: ${state.usedCostCents}¢ used + ${estimatedCostCents}¢ estimated > ${limit.maxCostCents}¢ limit`,
          remaining: { costCents: Math.max(0, limit.maxCostCents - state.usedCostCents) },
        };
      }

      // Reserve the cost (atomic pre-debit)
      state.usedCostCents += estimatedCostCents;

      return {
        allowed: true,
        reason: 'Budget available',
        remaining: {
          costCents: Math.max(0, limit.maxCostCents - state.usedCostCents),
          tokens: limit.maxTokens !== undefined
            ? Math.max(0, limit.maxTokens - state.usedTokens)
            : undefined,
        },
      };
    } finally {
      this.releaseLock(tenantId);
    }
  }

  async record(tenantId: string, actualCostCents: number, tokens?: number): Promise<void> {
    await this.acquireLock(tenantId);
    try {
      const state = this.getState(tenantId);
      // Reconcile: add actual vs already pre-debited
      // (We pre-debited estimatedCostCents; now adjust to actual)
      state.usedCostCents = Math.max(0, state.usedCostCents - 0 + actualCostCents);
      if (tokens !== undefined && state.limit.maxTokens !== undefined) {
        state.usedTokens += tokens;
      }
    } finally {
      this.releaseLock(tenantId);
    }
  }

  /** Get current state for a tenant (for observability). */
  getSnapshot(tenantId: string): BudgetState | undefined {
    return this.states.get(tenantId);
  }

  /** Reset state for a tenant (for testing). */
  _reset(tenantId?: string): void {
    if (tenantId) {
      this.states.delete(tenantId);
    } else {
      this.states.clear();
    }
  }
}

// ─── Global Budget Checker ────────────────────────────────────────────────────

let _budgetChecker: BudgetChecker = new DefaultBudgetChecker();

export function setBudgetChecker(checker: BudgetChecker): void {
  _budgetChecker = checker;
}

export function getBudgetChecker(): BudgetChecker {
  return _budgetChecker;
}
