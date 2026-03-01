/**
 * @fileoverview Load and Stress Tests
 *
 * Validates system behavior under load:
 *   - Concurrent request handling (100+ simultaneous)
 *   - Rate limit stress test
 *   - Memory pressure test
 *   - Circuit breaker trip/recovery test
 *   - Budget exhaustion under load
 *
 * INVARIANT: System remains stable under expected load.
 * INVARIANT: Rate limits protect system from overload.
 * INVARIANT: Circuit breakers prevent cascade failures.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AiErrorCode } from '../../errors/codes';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoadTestResult {
  successful: number;
  failed: number;
  throttled: number;
  totalTimeMs: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  errors: Array<{ code: string; count: number }>;
}

interface RateLimiter {
  allowRequest(tenantId: string): { allowed: boolean; retryAfterMs?: number };
  recordRequest(tenantId: string): void;
}

interface CircuitBreaker {
  state: 'closed' | 'open' | 'half_open';
  allowRequest(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
}

interface MemoryStore {
  getSize(): number;
  getLimit(): number;
  isUnderPressure(): boolean;
  evictOldest(count: number): void;
}

// ─── Mock Implementations ─────────────────────────────────────────────────────

class TokenBucketRateLimiter implements RateLimiter {
  private buckets = new Map<string, { tokens: number; lastUpdate: number }>();
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity = 100, refillRate = 10) {
    this.capacity = capacity;
    this.refillRate = refillRate;
  }

  allowRequest(tenantId: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    let bucket = this.buckets.get(tenantId);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastUpdate: now };
      this.buckets.set(tenantId, bucket);
    }

    // Refill tokens
    const elapsedMs = now - bucket.lastUpdate;
    const tokensToAdd = (elapsedMs / 1000) * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastUpdate = now;

    if (bucket.tokens >= 1) {
      return { allowed: true };
    }

    const retryAfterMs = Math.ceil((1 - bucket.tokens) / this.refillRate * 1000);
    return { allowed: false, retryAfterMs };
  }

  recordRequest(tenantId: string): void {
    const bucket = this.buckets.get(tenantId);
    if (bucket) {
      bucket.tokens = Math.max(0, bucket.tokens - 1);
    }
  }

  reset(): void {
    this.buckets.clear();
  }
}

class CountBasedCircuitBreaker implements CircuitBreaker {
  state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeoutMs: number;

  constructor(failureThreshold = 5, successThreshold = 3, timeoutMs = 5000) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeoutMs = timeoutMs;
  }

  allowRequest(): boolean {
    if (this.state === 'closed') return true;

    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.timeoutMs) {
        this.state = 'half_open';
        this.successCount = 0;
        return true;
      }
      return false;
    }

    return this.state === 'half_open';
  }

  recordSuccess(): void {
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half_open' || this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

class SimpleMemoryStore implements MemoryStore {
  private items = new Map<string, { data: unknown; timestamp: number }>();
  private limit: number;

  constructor(limit = 10000) {
    this.limit = limit;
  }

  getSize(): number {
    return this.items.size;
  }

  getLimit(): number {
    return this.limit;
  }

  isUnderPressure(): boolean {
    return this.items.size > this.limit * 0.9; // 90% threshold
  }

  add(key: string, data: unknown): void {
    if (this.items.size >= this.limit) {
      this.evictOldest(1);
    }
    this.items.set(key, { data, timestamp: Date.now() });
  }

  evictOldest(count: number): void {
    const entries = Array.from(this.items.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.items.delete(entries[i][0]);
    }
  }

  reset(): void {
    this.items.clear();
  }
}

// ─── Load Test Runner ─────────────────────────────────────────────────────────

async function runLoadTest(options: {
  concurrency: number;
  requestsPerClient: number;
  requestFn: () => Promise<{ success: boolean; error?: string; latencyMs: number }>;
}): Promise<LoadTestResult> {
  const latencies: number[] = [];
  const errors = new Map<string, number>();
  let successful = 0;
  let failed = 0;
  let throttled = 0;

  const startTime = Date.now();

  // Create concurrent clients
  const clients = Array(options.concurrency).fill(null).map(async () => {
    for (let i = 0; i < options.requestsPerClient; i++) {
      const result = await options.requestFn();
      latencies.push(result.latencyMs);

      if (result.success) {
        successful++;
      } else if (result.error?.includes('RATE_LIMITED') || result.error?.includes('throttled')) {
        throttled++;
      } else {
        failed++;
        const errorCode = result.error || 'UNKNOWN';
        errors.set(errorCode, (errors.get(errorCode) || 0) + 1);
      }
    }
  });

  await Promise.all(clients);
  const totalTimeMs = Date.now() - startTime;

  // Calculate percentiles
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  return {
    successful,
    failed,
    throttled,
    totalTimeMs,
    p50LatencyMs: p50,
    p99LatencyMs: p99,
    errors: Array.from(errors.entries()).map(([code, count]) => ({ code, count })),
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Load and Stress Tests', () => {
  describe('Concurrent Request Handling (100+ simultaneous)', () => {
    test('handles 100 concurrent requests', async () => {
      let requestCount = 0;

      const result = await runLoadTest({
        concurrency: 100,
        requestsPerClient: 1,
        requestFn: async () => {
          requestCount++;
          // Simulate processing
          await new Promise(r => setTimeout(r, 10));
          return { success: true, latencyMs: 10 + Math.random() * 5 };
        },
      });

      assert.equal(result.successful, 100, 'All 100 requests should succeed');
      assert.equal(result.failed, 0, 'No requests should fail');
    });

    test('handles 500 concurrent requests with batching', async () => {
      const result = await runLoadTest({
        concurrency: 500,
        requestsPerClient: 1,
        requestFn: async () => {
          await new Promise(r => setTimeout(r, 5));
          return { success: true, latencyMs: 5 };
        },
      });

      assert.ok(result.successful >= 495, `At least 495 requests should succeed, got ${result.successful}`);
    });

    test('measures latency percentiles under load', async () => {
      const result = await runLoadTest({
        concurrency: 100,
        requestsPerClient: 10,
        requestFn: async () => {
          const latency = 20 + Math.random() * 30;
          await new Promise(r => setTimeout(r, latency));
          return { success: true, latencyMs: latency };
        },
      });

      assert.ok(result.p50LatencyMs > 0, 'Should have p50 latency');
      assert.ok(result.p99LatencyMs >= result.p50LatencyMs, 'p99 should be >= p50');
      assert.ok(result.totalTimeMs < 10000, 'Should complete within 10 seconds');
    });
  });

  describe('Rate Limit Stress Test', () => {
    let rateLimiter: TokenBucketRateLimiter;

    beforeEach(() => {
      rateLimiter = new TokenBucketRateLimiter(50, 10); // 50 capacity, 10/sec refill
    });

    afterEach(() => {
      rateLimiter.reset();
    });

    test('rate limiter blocks excess requests', async () => {
      const tenantId = 'test-tenant';
      let allowed = 0;
      let blocked = 0;

      // Burst of 100 requests
      for (let i = 0; i < 100; i++) {
        const result = rateLimiter.allowRequest(tenantId);
        if (result.allowed) {
          rateLimiter.recordRequest(tenantId);
          allowed++;
        } else {
          blocked++;
        }
      }

      assert.ok(allowed <= 50, `Allowed ${allowed} requests, should be <= 50 (capacity)`);
      assert.ok(blocked > 0, `Blocked ${blocked} requests, should have blocked some`);
    });

    test('rate limiter recovers over time', async () => {
      const tenantId = 'test-tenant';

      // Exhaust the bucket
      for (let i = 0; i < 50; i++) {
        const result = rateLimiter.allowRequest(tenantId);
        if (result.allowed) {
          rateLimiter.recordRequest(tenantId);
        }
      }

      // Should be blocked immediately after
      const immediateResult = rateLimiter.allowRequest(tenantId);
      assert.equal(immediateResult.allowed, false, 'Should be blocked after exhaustion');

      // Wait for refill
      await new Promise(r => setTimeout(r, 1100)); // Wait for >1 second

      // Should allow new requests
      const recoveredResult = rateLimiter.allowRequest(tenantId);
      assert.ok(recoveredResult.allowed, 'Should allow requests after refill');
    });

    test('reports retry-after header timing', () => {
      const tenantId = 'test-tenant';

      // Exhaust bucket
      for (let i = 0; i < 50; i++) {
        const result = rateLimiter.allowRequest(tenantId);
        if (result.allowed) rateLimiter.recordRequest(tenantId);
      }

      // Check retry-after
      const blockedResult = rateLimiter.allowRequest(tenantId);
      assert.equal(blockedResult.allowed, false);
      assert.ok(blockedResult.retryAfterMs && blockedResult.retryAfterMs > 0,
        'Should report retry-after time');
    });
  });

  describe('Memory Pressure Test', () => {
    let memoryStore: SimpleMemoryStore;

    beforeEach(() => {
      memoryStore = new SimpleMemoryStore(100); // Small limit for testing
    });

    afterEach(() => {
      memoryStore.reset();
    });

    test('detects memory pressure at 90% capacity', () => {
      // Add items up to 89% (should not be under pressure)
      for (let i = 0; i < 89; i++) {
        memoryStore.add(`key-${i}`, { data: i });
      }
      assert.equal(memoryStore.isUnderPressure(), false, 'Should not be under pressure at 89%');

      // Add one more (90%)
      memoryStore.add('key-90', { data: 90 });
      assert.equal(memoryStore.isUnderPressure(), true, 'Should be under pressure at 90%');
    });

    test('evicts oldest items when at capacity', () => {
      // Fill to capacity
      for (let i = 0; i < 100; i++) {
        memoryStore.add(`key-${i}`, { data: i });
      }

      assert.equal(memoryStore.getSize(), 100, 'Should be at capacity');

      // Add one more - should evict oldest
      memoryStore.add('new-key', { data: 'new' });

      assert.equal(memoryStore.getSize(), 100, 'Should stay at capacity');
    });

    test('handles memory pressure under concurrent access', async () => {
      const promises: Promise<void>[] = [];

      // Simulate concurrent writes
      for (let i = 0; i < 200; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              memoryStore.add(`concurrent-${i}`, { data: i });
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      await Promise.all(promises);

      assert.ok(memoryStore.getSize() <= 100, 'Should not exceed capacity');
    });
  });

  describe('Circuit Breaker Trip/Recovery Test', () => {
    let circuitBreaker: CountBasedCircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CountBasedCircuitBreaker(5, 3, 100); // Fast timeout for testing
    });

    afterEach(() => {
      circuitBreaker.reset();
    });

    test('circuit opens after threshold failures', () => {
      assert.equal(circuitBreaker.state, 'closed', 'Should start closed');

      // Record failures up to threshold
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      assert.equal(circuitBreaker.state, 'open', 'Should open after 5 failures');
      assert.equal(circuitBreaker.allowRequest(), false, 'Should block requests when open');
    });

    test('circuit recovers after timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      assert.equal(circuitBreaker.state, 'open');

      // Wait for timeout
      await new Promise(r => setTimeout(r, 150));

      // Should transition to half-open
      assert.equal(circuitBreaker.allowRequest(), true, 'Should allow test request');
      assert.equal(circuitBreaker.state, 'half_open', 'Should be half_open');
    });

    test('circuit closes after success threshold in half-open', () => {
      // Open circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      // Force to half-open (simulating timeout passed)
      circuitBreaker.state = 'half_open';
      circuitBreaker.successCount = 0;

      // Record successes
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordSuccess();
      }

      assert.equal(circuitBreaker.state, 'closed', 'Should close after 3 successes');
    });

    test('circuit reopens on failure in half-open', () => {
      // Open circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      // Force to half-open
      circuitBreaker.state = 'half_open';

      // Failure in half-open should reopen
      circuitBreaker.recordFailure();

      assert.equal(circuitBreaker.state, 'open', 'Should reopen on failure');
    });

    test('prevents cascade failures', async () => {
      // Simulate failing service
      const serviceCalls = 0;
      let blockedByCircuit = 0;

      for (let i = 0; i < 20; i++) {
        if (!circuitBreaker.allowRequest()) {
          blockedByCircuit++;
          continue;
        }

        // Simulate failure
        circuitBreaker.recordFailure();
        await new Promise(r => setTimeout(r, 10));
      }

      assert.ok(blockedByCircuit > 10, `Blocked ${blockedByCircuit} calls, should have blocked many`);
      assert.equal(circuitBreaker.state, 'open', 'Circuit should be open');
    });
  });

  describe('Budget Exhaustion Under Load', () => {
    test('enforces budget limits under concurrent load', async () => {
      const tenantBudgets = new Map<string, { used: number; limit: number }>();
      const tenantId = 'load-test-tenant';
      tenantBudgets.set(tenantId, { used: 0, limit: 100 });

      const results = await runLoadTest({
        concurrency: 50,
        requestsPerClient: 3,
        requestFn: async () => {
          const budget = tenantBudgets.get(tenantId)!;
          const cost = 5;

          if (budget.used + cost > budget.limit) {
            return {
              success: false,
              error: AiErrorCode.BUDGET_EXHAUSTED,
              latencyMs: 5,
            };
          }

          budget.used += cost;
          return { success: true, latencyMs: 5 + Math.random() * 10 };
        },
      });

      const finalBudget = tenantBudgets.get(tenantId)!;
      assert.ok(finalBudget.used <= finalBudget.limit, 'Should not exceed budget');

      // With 150 requests at cost 5 each, and limit 100, we expect ~20 successful
      assert.ok(results.successful <= 20, `Successful: ${results.successful}, should be limited by budget`);
    });

    test('isolates tenant budgets under shared load', async () => {
      const tenants = ['tenant-a', 'tenant-b', 'tenant-c'];
      const budgets = new Map(tenants.map(t => [t, { used: 0, limit: 50 }]));

      const promises = tenants.map(tenant =>
        runLoadTest({
          concurrency: 20,
          requestsPerClient: 5,
          requestFn: async () => {
            const budget = budgets.get(tenant)!;
            if (budget.used + 5 > budget.limit) {
              return { success: false, error: AiErrorCode.BUDGET_EXHAUSTED, latencyMs: 5 };
            }
            budget.used += 5;
            return { success: true, latencyMs: 5 };
          },
        })
      );

      await Promise.all(promises);

      // Each tenant should have independent budget consumption
      for (const tenant of tenants) {
        const budget = budgets.get(tenant)!;
        assert.ok(budget.used <= budget.limit, `${tenant} exceeded budget`);
        assert.equal(budget.used, 50, `${tenant} should have consumed full budget`);
      }
    });
  });

  describe('System Stability Under Load', () => {
    test('maintains response times under sustained load', async () => {
      const result = await runLoadTest({
        concurrency: 50,
        requestsPerClient: 20,
        requestFn: async () => {
          const latency = 10 + Math.random() * 20;
          await new Promise(r => setTimeout(r, latency));
          return { success: true, latencyMs: latency };
        },
      });

      assert.ok(result.p99LatencyMs < 100, `p99 latency ${result.p99LatencyMs}ms should be < 100ms`);
      assert.equal(result.failed, 0, 'Should have no failures');
    });

    test('gracefully degrades when overloaded', async () => {
      let activeRequests = 0;
      const maxConcurrent = 10;

      const result = await runLoadTest({
        concurrency: 100,
        requestsPerClient: 1,
        requestFn: async () => {
          if (activeRequests >= maxConcurrent) {
            return {
              success: false,
              error: 'OVERLOADED',
              latencyMs: 0,
            };
          }

          activeRequests++;
          await new Promise(r => setTimeout(r, 50));
          activeRequests--;

          return { success: true, latencyMs: 50 };
        },
      });

      assert.ok(result.failed > 0, 'Should reject some requests when overloaded');
      assert.ok(activeRequests <= maxConcurrent, 'Should never exceed max concurrent');
    });
  });
});

// ─── Export for use in other test suites ───────────────────────────────────────

export { runLoadTest, TokenBucketRateLimiter, CountBasedCircuitBreaker, SimpleMemoryStore };
