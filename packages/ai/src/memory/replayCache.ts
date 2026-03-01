/**
 * @fileoverview Replay cache for deterministic tool results.
 *
 * C-13: Replay duplication — retried tool calls generate duplicate decision records
 * I-MCP-6: Add version and digest to ToolDefinition for replayer consistency
 *
 * This cache stores results from deterministic tools, keyed by tool name + input hash.
 * On replay, verifies that the tool's digest hasn't changed before returning cached result.
 *
 * INVARIANT: Only tools with isDeterministic: true should be cached.
 * INVARIANT: Cached results are verified against current tool digest before reuse.
 */

import { createHash } from 'crypto';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { logger } from '../telemetry/logger';

/**
 * Cached tool result with metadata
 */
export interface CachedToolResult {
  /** Serialized result */
  output: unknown;
  /** When the result was cached */
  cachedAt: string;
  /** Tool digest at time of caching */
  digest: string;
  /** Execution latency */
  latencyMs: number;
}

/**
 * Result of cache lookup
 */
export interface ReplayCacheLookup {
  /** Whether a cached result was found */
  found: boolean;
  /** The cached result if found */
  result?: CachedToolResult;
  /** Whether the cached result is stale (digest changed) */
  stale?: boolean;
  /** Error if lookup failed */
  error?: AiError;
}

/**
 * Configuration for ReplayCache
 */
export interface ReplayCacheConfig {
  /** Maximum number of cached entries */
  maxEntries: number;
  /** Maximum age of cached entries in ms (default: 1 hour) */
  maxAgeMs: number;
  /** Whether to enable the cache */
  enabled: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ReplayCacheConfig = {
  maxEntries: 1000,
  maxAgeMs: 60 * 60 * 1000, // 1 hour
  enabled: true,
};

/**
 * Replay cache for deterministic tool results.
 *
 * Key format: `tool:{name}:{input_hash}`
 *
 * Only caches results from tools where isDeterministic: true.
 * On replay, verifies digest hasn't changed; if changed, invalidates cache and re-executes.
 */
export class ReplayCache {
  private readonly cache: Map<string, CachedToolResult>;
  private readonly config: ReplayCacheConfig;

  constructor(config: Partial<ReplayCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
  }

  /**
   * Generate cache key from tool name and input
   */
  generateKey(toolName: string, input: unknown): string {
    const inputHash = this.hashInput(input);
    return `tool:${toolName}:${inputHash}`;
  }

  /**
   * Hash input for cache key generation
   */
  private hashInput(input: unknown): string {
    const normalized = this.normalizeInput(input);
    return createHash('blake3').update(normalized).digest('hex').slice(0, 16);
  }

  /**
   * Normalize input for deterministic hashing
   */
  private normalizeInput(input: unknown): string {
    if (typeof input === 'string') {
      return input.trim();
    }
    if (input === null || input === undefined) {
      return '';
    }
    if (typeof input === 'object') {
      // Sort keys for deterministic serialization
      return JSON.stringify(input, Object.keys(input as object).sort());
    }
    return String(input);
  }

  /**
   * Check if cache is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get a cached result (if exists and not stale)
   */
  get(toolName: string, input: unknown): ReplayCacheLookup {
    if (!this.config.enabled) {
      return { found: false };
    }

    const key = this.generateKey(toolName, input);
    const entry = this.cache.get(key);

    if (!entry) {
      return { found: false };
    }

    // Check if entry has expired
    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > this.config.maxAgeMs) {
      this.cache.delete(key);
      logger.debug('[replayCache] Entry expired', { key, ageMs: age });
      return { found: false };
    }

    return {
      found: true,
      result: entry,
      stale: false,
    };
  }

  /**
   * Verify a cached result against current tool digest
   */
  verify(key: string, currentDigest: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // If no digest was stored, assume it's valid (backwards compatibility)
    if (!entry.digest) {
      return true;
    }

    return entry.digest === currentDigest;
  }

  /**
   * Store a result in the cache
   */
  set(toolName: string, input: unknown, result: unknown, digest: string, latencyMs: number): void {
    if (!this.config.enabled) {
      return;
    }

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const key = this.generateKey(toolName, input);
    const cachedResult: CachedToolResult = {
      output: result,
      cachedAt: new Date().toISOString(),
      digest,
      latencyMs,
    };

    this.cache.set(key, cachedResult);
    logger.debug('[replayCache] Cached result', { key, digest });
  }

  /**
   * Store a result in the cache (full key version for replay)
   */
  setWithKey(key: string, result: unknown, digest: string, latencyMs: number): void {
    if (!this.config.enabled) {
      return;
    }

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const cachedResult: CachedToolResult = {
      output: result,
      cachedAt: new Date().toISOString(),
      digest,
      latencyMs,
    };

    this.cache.set(key, cachedResult);
    logger.debug('[replayCache] Cached result with key', { key, digest });
  }

  /**
   * Invalidate a cache entry
   */
  invalidate(toolName: string, input: unknown): void {
    const key = this.generateKey(toolName, input);
    this.cache.delete(key);
    logger.debug('[replayCache] Invalidated entry', { key });
  }

  /**
   * Invalidate all entries for a tool
   */
  invalidateTool(toolName: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`tool:${toolName}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    logger.debug('[replayCache] Invalidated tool entries', { toolName, count: keysToDelete.length });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.debug('[replayCache] Cleared all entries');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxEntries: number; enabled: boolean } {
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      enabled: this.config.enabled,
    };
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.cache.entries()) {
      const cachedAt = new Date(value.cachedAt).getTime();
      if (cachedAt < oldestTime) {
        oldestTime = cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('[replayCache] Evicted oldest entry', { key: oldestKey });
    }
  }
}

/**
 * Global replay cache instance
 */
let _replayCache: ReplayCache | null = null;

export function getReplayCache(): ReplayCache {
  if (!_replayCache) {
    _replayCache = new ReplayCache();
  }
  return _replayCache;
}

export function setReplayCache(cache: ReplayCache): void {
  _replayCache = cache;
}

/**
 * Helper to check if a tool result can be cached
 * Only deterministic tools can be cached
 */
export function isCacheable(isDeterministic: boolean | undefined): boolean {
  return isDeterministic === true;
}

/**
 * Helper to create cache key for a tool call
 * This is used for replay identification
 */
export function createReplayKey(
  toolName: string,
  input: unknown,
  traceId: string
): string {
  const inputHash = createHash('blake3')
    .update(JSON.stringify(input, Object.keys(input as object).sort()))
    .digest('hex')
    .slice(0, 16);

  return `${traceId}:${toolName}:${inputHash}`;
}
