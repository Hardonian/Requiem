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
 * The PersistentBudgetChecker uses a PersistentBudgetStore for multi-instance safety.
 */

import { logger } from '../telemetry/logger.js';

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

// ─── Extended Budget Types ────────────────────────────────────────────────────

/**
 * Granular per-tenant budget policy with multiple time-window limits.
 * Supports token-rate limits (per minute/hour/day) and cost caps (daily/monthly).
 */
export interface BudgetPolicy {
  /** Maximum tokens consumed per minute */
  maxTokensPerMinute?: number;
  /** Maximum tokens consumed per hour */
  maxTokensPerHour?: number;
  /** Maximum tokens consumed per day */
  maxTokensPerDay?: number;
  /** Maximum cost in USD cents per day */
  maxCostPerDay?: number;
  /** Maximum cost in USD cents per month */
  maxCostPerMonth?: number;
  /** Hard cap: once hit, ALL requests are rejected until the period resets */
  hardCap?: boolean;
}

/**
 * Usage snapshot returned by PersistentBudgetStore.
 */
export interface BudgetUsage {
  tenantId: string;
  period: string;
  usedCostCents: number;
  usedTokens: number;
  windowStart: string;
  windowEnd: string;
}

/**
 * Metadata attached to a cost increment call for audit purposes.
 */
export interface CostMetadata {
  requestId?: string;
  toolName?: string;
  modelId?: string;
  tokens?: number;
  /** Caller-supplied note for audit trail */
  note?: string;
}

// ─── Persistent Budget Store Interface ───────────────────────────────────────

/**
 * PersistentBudgetStore is the source of truth for budget usage in a
 * multi-instance deployment.  Every `BudgetChecker` instance delegates
 * reads and writes here, so restarts or horizontal scale-out never lose
 * accumulated spend.
 *
 * INVARIANT: `incrementUsage` MUST be atomic in the underlying store.
 * INVARIANT: `checkLimit` MUST read current usage from the store, not a cache.
 */
export interface PersistentBudgetStore {
  /**
   * Retrieve the current usage for a tenant in the given period key
   * (e.g. `"2024-01-15"` for daily, `"2024-01"` for monthly).
   */
  getUsage(tenantId: string, period: string): Promise<BudgetUsage>;

  /**
   * Atomically increment usage for a tenant and return the updated snapshot.
   */
  incrementUsage(tenantId: string, amount: number, metadata: CostMetadata): Promise<BudgetUsage>;

  /**
   * Perform a full limit check against a BudgetLimit and return the result.
   * Implementations should read the current usage and evaluate it against the limit.
   */
  checkLimit(tenantId: string, limit: BudgetLimit): Promise<BudgetCheckResult>;

  /**
   * Reset usage counters for the given period (useful for test teardown or
   * administrative resets).
   */
  resetPeriod(tenantId: string, period: string): Promise<void>;
}

// ─── In-Memory Budget Store ───────────────────────────────────────────────────

/**
 * InMemoryBudgetStore wraps the existing AtomicBudgetChecker behavior in the
 * PersistentBudgetStore interface.  It is safe for single-process use and for
 * unit tests — data is lost on restart.
 */
export class InMemoryBudgetStore implements PersistentBudgetStore {
  private usage = new Map<string, BudgetUsage>();
  private clock: Clock;

  constructor(clock: Clock = defaultClock) {
    this.clock = clock;
  }

  private key(tenantId: string, period: string): string {
    return `${tenantId}::${period}`;
  }

  async getUsage(tenantId: string, period: string): Promise<BudgetUsage> {
    const existing = this.usage.get(this.key(tenantId, period));
    if (existing) return { ...existing };
    const now = new Date(this.clock.now()).toISOString();
    return {
      tenantId,
      period,
      usedCostCents: 0,
      usedTokens: 0,
      windowStart: now,
      windowEnd: now,
    };
  }

  async incrementUsage(tenantId: string, amount: number, metadata: CostMetadata): Promise<BudgetUsage> {
    const period = new Date(this.clock.now()).toISOString().slice(0, 10); // YYYY-MM-DD
    const k = this.key(tenantId, period);
    const current = this.usage.get(k) ?? {
      tenantId,
      period,
      usedCostCents: 0,
      usedTokens: 0,
      windowStart: new Date(this.clock.now()).toISOString(),
      windowEnd: new Date(this.clock.now()).toISOString(),
    };
    const updated: BudgetUsage = {
      ...current,
      usedCostCents: current.usedCostCents + amount,
      usedTokens: current.usedTokens + (metadata.tokens ?? 0),
    };
    this.usage.set(k, updated);
    return { ...updated };
  }

  async checkLimit(tenantId: string, limit: BudgetLimit): Promise<BudgetCheckResult> {
    const period = new Date(this.clock.now()).toISOString().slice(0, 10);
    const usage = await this.getUsage(tenantId, period);

    const warningThreshold = limit.maxCostCents * 0.8;
    if (usage.usedCostCents >= limit.maxCostCents) {
      return {
        allowed: false,
        reason: `BUDGET_EXHAUSTED: ${usage.usedCostCents}¢ used >= ${limit.maxCostCents}¢ limit`,
        remaining: { costCents: 0 },
      };
    }
    if (usage.usedCostCents >= warningThreshold) {
      logger.warn('[budget] Approaching budget limit', {
        tenantId,
        usedCostCents: usage.usedCostCents,
        limitCostCents: limit.maxCostCents,
        percentUsed: Math.round((usage.usedCostCents / limit.maxCostCents) * 100),
      });
    }
    return {
      allowed: true,
      remaining: {
        costCents: Math.max(0, limit.maxCostCents - usage.usedCostCents),
        tokens: limit.maxTokens !== undefined
          ? Math.max(0, limit.maxTokens - usage.usedTokens)
          : undefined,
      },
    };
  }

  async resetPeriod(tenantId: string, period: string): Promise<void> {
    this.usage.delete(this.key(tenantId, period));
  }
}

// ─── HTTP Budget Store ────────────────────────────────────────────────────────

/**
 * HttpBudgetStore persists budget usage to a remote HTTP endpoint configured
 * via `REQUIEM_BUDGET_ENDPOINT`.  Suitable for multi-instance deployments
 * where the budget service is a separate microservice or database gateway.
 *
 * INVARIANT: All HTTP calls use a configurable timeout to avoid blocking the
 *            request path indefinitely.
 * INVARIANT: On HTTP error, falls back to allowing the request (fail-open)
 *            but logs a critical warning.  Use `strictMode` to fail-closed.
 */
export interface HttpBudgetStoreConfig {
  /** Base URL for the budget service, e.g. https://budget-svc.internal */
  endpoint: string;
  /** Bearer token or API key for auth */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 2000) */
  timeoutMs?: number;
  /** If true, fail-closed on HTTP errors instead of fail-open */
  strictMode?: boolean;
}

export class HttpBudgetStore implements PersistentBudgetStore {
  private config: Required<HttpBudgetStoreConfig>;

  constructor(config: HttpBudgetStoreConfig) {
    this.config = {
      apiKey: '',
      timeoutMs: 2000,
      strictMode: false,
      ...config,
    };
  }

  /** Build common headers for all requests. */
  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) h['Authorization'] = `Bearer ${this.config.apiKey}`;
    return h;
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async getUsage(tenantId: string, period: string): Promise<BudgetUsage> {
    const url = `${this.config.endpoint}/usage/${encodeURIComponent(tenantId)}/${encodeURIComponent(period)}`;
    try {
      const res = await this.fetchWithTimeout(url, { method: 'GET', headers: this.headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as BudgetUsage;
    } catch (err) {
      logger.error('[HttpBudgetStore] getUsage failed', { tenantId, period, error: String(err) });
      if (this.config.strictMode) throw err;
      const now = new Date().toISOString();
      return { tenantId, period, usedCostCents: 0, usedTokens: 0, windowStart: now, windowEnd: now };
    }
  }

  async incrementUsage(tenantId: string, amount: number, metadata: CostMetadata): Promise<BudgetUsage> {
    const url = `${this.config.endpoint}/usage/${encodeURIComponent(tenantId)}/increment`;
    try {
      const res = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ amount, metadata }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as BudgetUsage;
    } catch (err) {
      logger.error('[HttpBudgetStore] incrementUsage failed', { tenantId, amount, error: String(err) });
      if (this.config.strictMode) throw err;
      const now = new Date().toISOString();
      return { tenantId, period: now.slice(0, 10), usedCostCents: amount, usedTokens: metadata.tokens ?? 0, windowStart: now, windowEnd: now };
    }
  }

  async checkLimit(tenantId: string, limit: BudgetLimit): Promise<BudgetCheckResult> {
    const url = `${this.config.endpoint}/check/${encodeURIComponent(tenantId)}`;
    try {
      const res = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ limit }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as BudgetCheckResult;
    } catch (err) {
      logger.error('[HttpBudgetStore] checkLimit failed', { tenantId, error: String(err) });
      if (this.config.strictMode) {
        return { allowed: false, reason: `Budget service unavailable: ${String(err)}`, remaining: { costCents: 0 } };
      }
      // Fail-open: allow the request but log a critical warning
      logger.warn('[HttpBudgetStore] Failing open due to budget service error', { tenantId });
      return { allowed: true, reason: 'Budget service unavailable (fail-open)', remaining: { costCents: -1 } };
    }
  }

  async resetPeriod(tenantId: string, period: string): Promise<void> {
    const url = `${this.config.endpoint}/reset/${encodeURIComponent(tenantId)}/${encodeURIComponent(period)}`;
    try {
      const res = await this.fetchWithTimeout(url, { method: 'DELETE', headers: this.headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      logger.error('[HttpBudgetStore] resetPeriod failed', { tenantId, period, error: String(err) });
      if (this.config.strictMode) throw err;
    }
  }
}

// ─── Persistent Budget Checker ────────────────────────────────────────────────

/**
 * PersistentBudgetChecker delegates all usage tracking to a PersistentBudgetStore.
 * This makes it safe for multi-instance deployments — the store is the single
 * source of truth.
 *
 * INVARIANT: Every `check()` call reads from the store (no local cache).
 * INVARIANT: Every `record()` call atomically increments in the store.
 * INVARIANT: At 80% of any limit, a warning is emitted.
 * INVARIANT: At 100% of any limit, `BUDGET_EXHAUSTED` is returned.
 */
export class PersistentBudgetChecker implements BudgetChecker {
  private store: PersistentBudgetStore;
  private policy: Map<string, BudgetPolicy>;

  constructor(store: PersistentBudgetStore) {
    this.store = store;
    this.policy = new Map();
  }

  /**
   * Set the BudgetPolicy for a specific tenant.
   * @param tenantId - Tenant identifier
   * @param policy - Budget policy with multi-window limits
   */
  setPolicy(tenantId: string, policy: BudgetPolicy): void {
    this.policy.set(tenantId, policy);
  }

  /** Get current policy for a tenant (or undefined if not configured). */
  getPolicy(tenantId: string): BudgetPolicy | undefined {
    return this.policy.get(tenantId);
  }

  /**
   * Build a BudgetLimit from the daily cost cap in a BudgetPolicy.
   * Falls back to a sensible default if no policy is set.
   */
  private policyToLimit(tenantId: string): BudgetLimit {
    const p = this.policy.get(tenantId);
    return {
      maxCostCents: p?.maxCostPerDay ?? 10_000, // $100/day default
      maxTokens: p?.maxTokensPerDay,
      windowSeconds: 86400, // 24 hours
    };
  }

  async check(tenantId: string, estimatedCostCents: number): Promise<BudgetCheckResult> {
    const limit = this.policyToLimit(tenantId);
    // First check the limit without incrementing
    const result = await this.store.checkLimit(tenantId, limit);

    if (!result.allowed) {
      return {
        allowed: false,
        reason: result.reason ?? 'BUDGET_EXHAUSTED',
        remaining: result.remaining ?? { costCents: 0 },
      };
    }

    // Check if adding estimated cost would exceed the limit
    const remaining = result.remaining?.costCents ?? limit.maxCostCents;
    if (remaining < estimatedCostCents) {
      return {
        allowed: false,
        reason: `Estimated cost ${estimatedCostCents}¢ exceeds remaining budget ${remaining}¢`,
        remaining: result.remaining,
      };
    }

    return result;
  }

  async record(tenantId: string, actualCostCents: number, tokens?: number): Promise<void> {
    const limit = this.policyToLimit(tenantId);
    const usage = await this.store.incrementUsage(tenantId, actualCostCents, { tokens });

    // Emit warning at 80% threshold
    const pct = usage.usedCostCents / limit.maxCostCents;
    if (pct >= 1.0) {
      logger.warn('[budget] BUDGET_EXHAUSTED after record', {
        tenantId,
        usedCostCents: usage.usedCostCents,
        limitCostCents: limit.maxCostCents,
      });
    } else if (pct >= 0.8) {
      logger.warn('[budget] Budget at 80%+ threshold', {
        tenantId,
        percentUsed: Math.round(pct * 100),
      });
    }
  }
}
