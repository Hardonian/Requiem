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
  protected readonly config: RateLimitConfig;
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

// ─── HTTP Distributed Rate Limit Store ────────────────────────────────────────

/**
 * HTTP-based distributed rate limit store for multi-instance deployments.
 * Communicates with a central rate limit service.
 */
export class HttpRateLimitStore implements DistributedRateLimitStore {
  private readonly endpoint: string;
  private readonly apiKey?: string;

  constructor(endpoint: string, apiKey?: string) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  async check(tenantId: string, windowMs: number, limit: number): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.endpoint}/check`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tenantId, windowMs, limit }),
      });

      if (!response.ok) {
        logger.warn('[rateLimit:http] Check failed', { status: response.status, tenantId });
        // Fail open - allow request if store is down
        return true;
      }

      const data = await response.json() as { allowed: boolean };
      return data.allowed;
    } catch (err) {
      logger.warn('[rateLimit:http] Check error', { error: String(err), tenantId });
      // Fail open on network errors
      return true;
    }
  }

  async remaining(tenantId: string, windowMs: number, limit: number): Promise<number> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(
        `${this.endpoint}/status?tenantId=${encodeURIComponent(tenantId)}&windowMs=${windowMs}&limit=${limit}`,
        { headers }
      );

      if (!response.ok) {
        return limit; // Fail open
      }

      const data = await response.json() as { remaining: number };
      return data.remaining;
    } catch (err) {
      return limit; // Fail open
    }
  }

  async reset(tenantId: string): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      await fetch(`${this.endpoint}/reset?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers,
      });
    } catch (err) {
      logger.warn('[rateLimit:http] Reset error', { error: String(err), tenantId });
    }
  }
}

// ─── Per-IP Rate Limiter ──────────────────────────────────────────────────────

/** IP-based bucket state. */
interface IpBucketState {
  timestamps: number[];
  blocked?: boolean;
  blockedUntil?: number;
}

/**
 * Per-IP rate limiter for DDoS protection at the transport layer.
 */
export class IpRateLimiter {
  private readonly buckets = new Map<string, IpBucketState>();
  private readonly config: RateLimitConfig;
  private readonly windowMs = 60_000; // 1 minute window

  constructor(config?: RateLimitConfig) {
    this.config = config ?? loadRateLimitConfig();
  }

  /**
   * Check if an IP is within rate limit.
   * @param ip - Client IP address
   * @returns true if allowed, false if rate limited
   */
  check(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const limit = this.config.ipRpm;

    // Check if IP is currently blocked
    const bucket = this.buckets.get(ip);
    if (bucket?.blocked) {
      if (bucket.blockedUntil && now < bucket.blockedUntil) {
        return false;
      }
      // Unblock if grace period expired
      bucket.blocked = false;
      delete bucket.blockedUntil;
    }

    if (!this.buckets.has(ip)) {
      this.buckets.set(ip, { timestamps: [] });
    }
    const currentBucket = this.buckets.get(ip)!;

    // Trim stale entries
    currentBucket.timestamps = currentBucket.timestamps.filter(t => t > windowStart);

    if (currentBucket.timestamps.length >= limit) {
      // Block IP for 5 minutes on rate limit
      currentBucket.blocked = true;
      currentBucket.blockedUntil = now + 5 * 60 * 1000;
      logger.warn('[rateLimit:ip] IP blocked', { ip, limit, count: currentBucket.timestamps.length });
      return false;
    }

    currentBucket.timestamps.push(now);
    return true;
  }

  /**
   * Get remaining requests for an IP.
   */
  remaining(ip: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const limit = this.config.ipRpm;
    const bucket = this.buckets.get(ip);

    if (!bucket) return limit;

    const active = bucket.timestamps.filter(t => t > windowStart).length;
    return Math.max(0, limit - active);
  }

  /**
   * Check if an IP is currently blocked.
   */
  isBlocked(ip: string): boolean {
    const bucket = this.buckets.get(ip);
    if (!bucket?.blocked) return false;

    if (bucket.blockedUntil && Date.now() >= bucket.blockedUntil) {
      bucket.blocked = false;
      delete bucket.blockedUntil;
      return false;
    }

    return true;
  }

  /**
   * Reset rate limit for an IP.
   */
  reset(ip: string): void {
    this.buckets.delete(ip);
  }

  /**
   * Get rate limit status for an IP.
   */
  getStatus(ip: string): {
    allowed: boolean;
    remaining: number;
    resetAt: string;
    blocked: boolean;
  } {
    const blocked = this.isBlocked(ip);
    const remaining = this.remaining(ip);
    const resetAt = new Date(Date.now() + this.windowMs).toISOString();

    return {
      allowed: !blocked && remaining > 0,
      remaining,
      resetAt,
      blocked,
    };
  }
}

// ─── Enhanced Rate Limiter with Distributed Support ───────────────────────────

/**
 * Enhanced rate limiter with distributed store support.
 */
export class EnhancedRateLimiter extends SlidingWindowRateLimiter {
  private readonly distributedStore?: DistributedRateLimitStore;
  private readonly ipLimiter: IpRateLimiter;

  constructor(config?: RateLimitConfig, distributedStore?: DistributedRateLimitStore) {
    super(config);
    this.ipLimiter = new IpRateLimiter(config);

    if (this.config.distributed && this.config.distributedEndpoint) {
      this.distributedStore = distributedStore ?? new HttpRateLimitStore(this.config.distributedEndpoint);
    }
  }

  /**
   * Check rate limit with distributed support.
   */
  async checkAsync(tenantId: string): Promise<boolean> {
    // First check local limit
    const localAllowed = this.check(tenantId);
    if (!localAllowed) return false;

    // Then check distributed limit if configured
    if (this.distributedStore) {
      const distributedAllowed = await this.distributedStore.check(
        tenantId,
        60_000,
        this.config.rpm + this.config.burst
      );
      return distributedAllowed;
    }

    return true;
  }

  /**
   * Check IP-based rate limit.
   */
  checkIp(ip: string): boolean {
    return this.ipLimiter.check(ip);
  }

  /**
   * Get IP rate limit status.
   */
  getIpStatus(ip: string): ReturnType<IpRateLimiter['getStatus']> {
    return this.ipLimiter.getStatus(ip);
  }

  /**
   * Get full rate limit status for a tenant.
   */
  async getStatus(tenantId: string): Promise<RateLimitStatus> {
    const limit = this.config.rpm + this.config.burst;
    const windowMs = 60_000;

    let remaining: number;

    if (this.distributedStore) {
      remaining = await this.distributedStore.remaining(tenantId, windowMs, limit);
    } else {
      remaining = this.remaining(tenantId);
    }

    return {
      tenantId,
      limit,
      remaining,
      resetAt: new Date(Date.now() + windowMs).toISOString(),
      windowMs,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** Module-level singleton rate limiter instance. */
let _limiter: SlidingWindowRateLimiter | null = null;
let _enhancedLimiter: EnhancedRateLimiter | null = null;
let _ipLimiter: IpRateLimiter | null = null;

/**
 * Get (or lazily create) the singleton rate limiter.
 * Config is read from env on first access; subsequent calls reuse the instance.
 * 
 * WARNING: In production (NODE_ENV=production), distributed rate limiting is REQUIRED.
 * Set REQUIEM_RATE_LIMIT_DISTRIBUTED=true and configure REQUIEM_RATE_LIMIT_ENDPOINT.
 */
export function getRateLimiter(): SlidingWindowRateLimiter {
  if (!_limiter) {
    const config = loadRateLimitConfig();
    
    // Production validation: warn if distributed mode is not enabled
    if (process.env.NODE_ENV === 'production' && !config.distributed) {
      logger.error(
        '[rate-limiter] CRITICAL: In-memory rate limiting is not safe for multi-instance production deployments. ' +
        'Set REQUIEM_RATE_LIMIT_DISTRIBUTED=true and configure REQUIEM_RATE_LIMIT_ENDPOINT for Redis-based rate limiting.'
      );
    }
    
    if (config.distributed) {
      _limiter = new EnhancedRateLimiter(config);
    } else {
      _limiter = new SlidingWindowRateLimiter(config);
      
      // Log warning about in-memory limitations
      if (!config.distributed) {
        logger.warn(
          '[rate-limiter] Using in-memory rate limiter - not suitable for multi-instance deployments. ' +
          'Requests may bypass rate limits when load-balanced across multiple pods.'
        );
      }
    }
  }
  return _limiter;
}

/**
 * Get the enhanced rate limiter with distributed support.
 */
export function getEnhancedRateLimiter(): EnhancedRateLimiter {
  if (!_enhancedLimiter) {
    _enhancedLimiter = new EnhancedRateLimiter();
  }
  return _enhancedLimiter;
}

/**
 * Get the IP-based rate limiter.
 */
export function getIpRateLimiter(): IpRateLimiter {
  if (!_ipLimiter) {
    _ipLimiter = new IpRateLimiter();
  }
  return _ipLimiter;
}

/** Replace the singleton — intended for testing only. */
export function _setRateLimiter(limiter: SlidingWindowRateLimiter | null): void {
  _limiter = limiter;
}

/** Replace the enhanced limiter — intended for testing only. */
export function _setEnhancedRateLimiter(limiter: EnhancedRateLimiter | null): void {
  _enhancedLimiter = limiter;
}

/** Replace the IP limiter — intended for testing only. */
export function _setIpRateLimiter(limiter: IpRateLimiter | null): void {
  _ipLimiter = limiter;
}
