/**
 * @fileoverview Rate limiting infrastructure for MCP transport.
 *
 * Provides per-tenant sliding window rate limiting configurable via env vars:
 *   REQUIEM_RATE_LIMIT_RPM   — requests per minute per tenant (default: 60)
 *   REQUIEM_RATE_LIMIT_BURST — burst allowance on top of RPM (default: 10)
 *   REQUIEM_RATE_LIMIT_IP_RPM — per-IP rate limit (default: 120)
 *
 * INVARIANT: Rate limits are applied per-tenant after auth is resolved.
 * INVARIANT: Per-IP limits are enforced at the transport layer.
 * INVARIANT: Distributed rate limiting via HTTP store for multi-instance deployments.
 */

import { logger } from '../telemetry/logger';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Parsed rate-limit configuration from environment. */
export interface RateLimitConfig {
  /** Maximum sustained requests per minute per tenant. */
  rpm: number;
  /** Additional burst requests allowed above the sustained rate. */
  burst: number;
  /** Per-IP rate limit (RPM) for DDoS protection. */
  ipRpm: number;
  /** Enable distributed rate limiting via HTTP. */
  distributed: boolean;
  /** HTTP endpoint for distributed rate limiting. */
  distributedEndpoint?: string;
}

/**
 * Rate limit status for a client.
 */
export interface RateLimitStatus {
  tenantId: string;
  limit: number;
  remaining: number;
  resetAt: string;
  windowMs: number;
}

/**
 * Distributed rate limit store interface.
 */
export interface DistributedRateLimitStore {
  check(tenantId: string, windowMs: number, limit: number): Promise<boolean>;
  remaining(tenantId: string, windowMs: number, limit: number): Promise<number>;
  reset(tenantId: string): Promise<void>;
}

/**
 * Load rate limit configuration from environment variables.
 * Falls back to safe defaults if variables are absent or invalid.
 */
export function loadRateLimitConfig(): RateLimitConfig {
  const rpm = parseInt(process.env.REQUIEM_RATE_LIMIT_RPM ?? '60', 10);
  const burst = parseInt(process.env.REQUIEM_RATE_LIMIT_BURST ?? '10', 10);
  const ipRpm = parseInt(process.env.REQUIEM_RATE_LIMIT_IP_RPM ?? '120', 10);
  const distributed = process.env.REQUIEM_RATE_LIMIT_DISTRIBUTED === 'true';
  const distributedEndpoint = process.env.REQUIEM_RATE_LIMIT_ENDPOINT;
  
  return {
    rpm: Number.isFinite(rpm) && rpm > 0 ? rpm : 60,
    burst: Number.isFinite(burst) && burst >= 0 ? burst : 10,
    ipRpm: Number.isFinite(ipRpm) && ipRpm > 0 ? ipRpm : 120,
    distributed,
    distributedEndpoint,
  };
}

// ─── Sliding Window Rate Limiter ──────────────────────────────────────────────

/** Internal per-tenant bucket state. */
interface BucketState {
  /** Timestamps (ms) of recent requests within the sliding window. */
  timestamps: number[];
}

/**
 * Sliding window rate limiter.
 *
 * Stores per-tenant request timestamps and trims the window on each check.
 * Thread-safe for single-process Node.js execution (event loop serialisation).
 */
export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly config: RateLimitConfig;
  /** Window size in milliseconds (60 s). */
  private static readonly WINDOW_MS = 60_000;

  constructor(config?: RateLimitConfig) {
    this.config = config ?? loadRateLimitConfig();
  }

  /**
   * Check whether the given tenant is within the rate limit.
   *
   * @param tenantId - The validated tenant identifier from JWT claims.
   * @returns `true` if the request is allowed; `false` if the limit is exceeded.
   */
  check(tenantId: string): boolean {
    const now = Date.now();
    const windowStart = now - SlidingWindowRateLimiter.WINDOW_MS;
    const limit = this.config.rpm + this.config.burst;

    if (!this.buckets.has(tenantId)) {
      this.buckets.set(tenantId, { timestamps: [] });
    }
    const bucket = this.buckets.get(tenantId)!;

    // Trim stale entries outside the sliding window.
    bucket.timestamps = bucket.timestamps.filter(t => t > windowStart);

    if (bucket.timestamps.length >= limit) {
      return false;
    }

    bucket.timestamps.push(now);
    return true;
  }

  /**
   * Return the number of requests remaining for a tenant in the current window.
   *
   * @param tenantId - The validated tenant identifier.
   */
  remaining(tenantId: string): number {
    const now = Date.now();
    const windowStart = now - SlidingWindowRateLimiter.WINDOW_MS;
    const limit = this.config.rpm + this.config.burst;
    const bucket = this.buckets.get(tenantId);
    if (!bucket) return limit;
    const active = bucket.timestamps.filter(t => t > windowStart).length;
    return Math.max(0, limit - active);
  }

  /**
   * Reset the rate limit state for a specific tenant.
   * Useful in tests or after a tenant key rotation.
   *
   * @param tenantId - The tenant identifier to reset.
   */
  reset(tenantId: string): void {
    this.buckets.delete(tenantId);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** Module-level singleton rate limiter instance. */
let _limiter: SlidingWindowRateLimiter | null = null;

/**
 * Get (or lazily create) the singleton rate limiter.
 * Config is read from env on first access; subsequent calls reuse the instance.
 */
export function getRateLimiter(): SlidingWindowRateLimiter {
  if (!_limiter) {
    _limiter = new SlidingWindowRateLimiter();
  }
  return _limiter;
}

/** Replace the singleton — intended for testing only. */
export function _setRateLimiter(limiter: SlidingWindowRateLimiter | null): void {
  _limiter = limiter;
}
