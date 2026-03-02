/**
 * @fileoverview Metrics instrumentation for runtime observability.
 *
 * Provides:
 * - Execution timing logs (p50/p95/p99)
 * - Memory delta tracking
 * - CAS hit ratio logging
 * - Replay verification flag
 *
 * INVARIANT: All metrics are structured and disabled in prod by default.
 * INVARIANT: No secrets or PII are ever logged.
 * INVARIANT: Metrics can be enabled via REQUIEM_ENABLE_METRICS env flag.
 */

import { logger } from './logger.js';

// ─── Configuration ───────────────────────────────────────────────────────────

const METRICS_ENABLED = process.env.REQUIEM_ENABLE_METRICS === 'true';
const METRICS_DEBUG = process.env.REQUIEM_DEBUG_METRICS === 'true';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimingHistogram {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  count: number;
  avg: number;
}

export interface MemorySnapshot {
  timestamp: string;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

export interface MemoryDelta {
  timestamp: string;
  operation: string;
  durationMs: number;
  heapUsedDelta: number;
  heapTotalDelta: number;
  rssDelta: number;
}

export interface CasMetrics {
  timestamp: string;
  hits: number;
  misses: number;
  total: number;
  hitRatio: number;
  dedupSavings: number;
}

export interface ReplayVerification {
  timestamp: string;
  verified: boolean;
  hash: string;
  toolName: string;
  digestMatch: boolean;
  stale: boolean;
  error?: string;
}

// ─── Timing Tracking ─────────────────────────────────────────────────────────

const timingBuckets = new Map<string, number[]>();

/**
 * Record a timing measurement for an operation.
 */
export function recordTiming(operation: string, durationMs: number): void {
  if (!METRICS_ENABLED && !METRICS_DEBUG) return;

  if (!timingBuckets.has(operation)) {
    timingBuckets.set(operation, []);
  }
  timingBuckets.get(operation)!.push(durationMs);

  // Log individual timing in debug mode
  if (METRICS_DEBUG) {
    logger.debug('[metrics] timing', { operation, durationMs });
  }

  // Flush to log periodically (every 100 measurements)
  const bucket = timingBuckets.get(operation)!;
  if (bucket.length >= 100) {
    flushTimingHistogram(operation);
  }
}

/**
 * Calculate histogram percentiles from timing data.
 */
function calculateHistogram(values: number[]): TimingHistogram {
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const avg = sorted.reduce((a, b) => a + b, 0) / count;

  const percentile = (p: number): number => {
    const index = Math.ceil((p / 100) * count) - 1;
    return sorted[Math.max(0, Math.min(index, count - 1))];
  };

  return {
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    min,
    max,
    count,
    avg,
  };
}

/**
 * Flush timing histogram for an operation to logs.
 */
export function flushTimingHistogram(operation: string): void {
  if (!METRICS_ENABLED) return;

  const bucket = timingBuckets.get(operation);
  if (!bucket || bucket.length === 0) return;

  const histogram = calculateHistogram(bucket);
  logger.info('[metrics] timing_histogram', {
    operation,
    p50_ms: histogram.p50,
    p95_ms: histogram.p95,
    p99_ms: histogram.p99,
    min_ms: histogram.min,
    max_ms: histogram.max,
    count: histogram.count,
    avg_ms: Math.round(histogram.avg * 100) / 100,
  });

  // Clear bucket after flush
  timingBuckets.set(operation, []);
}

/**
 * Flush all timing histograms.
 */
export function flushAllTimingHistograms(): void {
  if (!METRICS_ENABLED) return;
  for (const operation of timingBuckets.keys()) {
    flushTimingHistogram(operation);
  }
}

// ─── Memory Tracking ─────────────────────────────────────────────────────────

/**
 * Capture current memory snapshot.
 */
export function captureMemorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
    arrayBuffers: usage.arrayBuffers || 0,
  };
}

/**
 * Calculate memory delta between two snapshots.
 */
export function calculateMemoryDelta(
  before: MemorySnapshot,
  after: MemorySnapshot,
  operation: string,
  durationMs: number
): MemoryDelta {
  return {
    timestamp: new Date().toISOString(),
    operation,
    durationMs,
    heapUsedDelta: after.heapUsed - before.heapUsed,
    heapTotalDelta: after.heapTotal - before.heapTotal,
    rssDelta: after.rss - before.rss,
  };
}

/**
 * Log memory delta for an operation.
 */
export function logMemoryDelta(delta: MemoryDelta): void {
  if (!METRICS_ENABLED) return;

  logger.info('[metrics] memory_delta', {
    operation: delta.operation,
    duration_ms: delta.durationMs,
    heap_used_delta_bytes: delta.heapUsedDelta,
    heap_total_delta_bytes: delta.heapTotalDelta,
    rss_delta_bytes: delta.rssDelta,
  });
}

/**
 * Track memory for a scoped operation.
 */
export async function withMemoryTracking<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!METRICS_ENABLED) {
    return fn();
  }

  const before = captureMemorySnapshot();
  const startTime = performance.now();

  try {
    return await fn();
  } finally {
    const durationMs = Math.round(performance.now() - startTime);
    const after = captureMemorySnapshot();
    const delta = calculateMemoryDelta(before, after, operation, durationMs);
    logMemoryDelta(delta);
  }
}

// ─── CAS Hit Ratio Tracking ──────────────────────────────────────────────────

let casMetrics: CasMetrics = {
  timestamp: new Date().toISOString(),
  hits: 0,
  misses: 0,
  total: 0,
  hitRatio: 0,
  dedupSavings: 0,
};

/**
 * Record a CAS (Content Addressed Storage) hit.
 */
export function recordCasHit(contentSize: number = 0): void {
  if (!METRICS_ENABLED) return;

  casMetrics.hits++;
  casMetrics.total++;
  casMetrics.hitRatio = casMetrics.hits / casMetrics.total;
  casMetrics.dedupSavings += contentSize;

  if (METRICS_DEBUG) {
    logger.debug('[metrics] cas_hit', { contentSize });
  }
}

/**
 * Record a CAS miss.
 */
export function recordCasMiss(): void {
  if (!METRICS_ENABLED) return;

  casMetrics.misses++;
  casMetrics.total++;
  casMetrics.hitRatio = casMetrics.hits / casMetrics.total;

  if (METRICS_DEBUG) {
    logger.debug('[metrics] cas_miss');
  }
}

/**
 * Get current CAS metrics.
 */
export function getCasMetrics(): CasMetrics {
  return { ...casMetrics, timestamp: new Date().toISOString() };
}

/**
 * Flush CAS metrics to logs.
 */
export function flushCasMetrics(): void {
  if (!METRICS_ENABLED || casMetrics.total === 0) return;

  logger.info('[metrics] cas_hit_ratio', {
    hits: casMetrics.hits,
    misses: casMetrics.misses,
    total: casMetrics.total,
    hit_ratio: Math.round(casMetrics.hitRatio * 1000) / 1000,
    dedup_savings_bytes: casMetrics.dedupSavings,
  });

  // Reset after flush
  casMetrics = {
    timestamp: new Date().toISOString(),
    hits: 0,
    misses: 0,
    total: 0,
    hitRatio: 0,
    dedupSavings: 0,
  };
}

// ─── Replay Verification Tracking ────────────────────────────────────────────

/**
 * Log replay verification result.
 */
export function logReplayVerification(verification: ReplayVerification): void {
  if (!METRICS_ENABLED) return;

  logger.info('[metrics] replay_verification', {
    verified: verification.verified,
    hash: verification.hash,
    tool_name: verification.toolName,
    digest_match: verification.digestMatch,
    stale: verification.stale,
    error: verification.error,
  });
}

/**
 * Record successful replay verification.
 */
export function recordReplaySuccess(hash: string, toolName: string): void {
  if (!METRICS_ENABLED) return;

  logReplayVerification({
    timestamp: new Date().toISOString(),
    verified: true,
    hash,
    toolName,
    digestMatch: true,
    stale: false,
  });
}

/**
 * Record failed replay verification.
 */
export function recordReplayFailure(
  hash: string,
  toolName: string,
  reason: string,
  stale: boolean = false
): void {
  if (!METRICS_ENABLED) return;

  logReplayVerification({
    timestamp: new Date().toISOString(),
    verified: false,
    hash,
    toolName,
    digestMatch: !stale,
    stale,
    error: reason,
  });
}

// ─── Batch Operations ────────────────────────────────────────────────────────

/**
 * Flush all metrics to logs.
 */
export function flushAllMetrics(): void {
  if (!METRICS_ENABLED) return;

  flushAllTimingHistograms();
  flushCasMetrics();

  logger.info('[metrics] flush_complete', {
    timestamp: new Date().toISOString(),
  });
}

// ─── Periodic Flush ──────────────────────────────────────────────────────────

let flushInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic metrics flushing (every 60 seconds).
 */
export function startMetricsFlush(): void {
  if (!METRICS_ENABLED || flushInterval) return;

  flushInterval = setInterval(() => {
    flushAllMetrics();
  }, 60000);

  // Ensure interval doesn't prevent process exit
  flushInterval.unref();
}

/**
 * Stop periodic metrics flushing.
 */
export function stopMetricsFlush(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}

// Auto-start if enabled
if (METRICS_ENABLED) {
  startMetricsFlush();
}

// Flush on exit
process.on('beforeExit', () => {
  flushAllMetrics();
  stopMetricsFlush();
});
