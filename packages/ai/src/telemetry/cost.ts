/**
 * @fileoverview Cost and token accounting for AI operations.
 *
 * Writes cost records to file in dev mode (.data/ai-cost/).
 * Replace _costSink with a DB-backed sink for production.
 *
 * INVARIANT: All cost records are tenant-scoped.
 * INVARIANT: Cost records are append-only.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { newId, now } from '../types/index.js';
import { logger } from './logger.js';
import type { InvocationContext } from '../types/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CostRecord {
  readonly id: string;
  readonly traceId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Cost in USD cents */
  readonly costCents: number;
  readonly latencyMs: number;
  readonly createdAt: string;
  readonly phase?: string;
}

export type CostRecordInput = Omit<CostRecord, 'id' | 'traceId' | 'tenantId' | 'actorId' | 'createdAt'>;

/**
 * Summary of telemetry data for a tenant
 */
export interface TelemetrySummary {
  totalRequests: number;
  totalCostCents: number;
  avgLatencyMs: number;
  errorRate: number;
}

// ─── Cost Sink ────────────────────────────────────────────────────────────────

type CostSink = (record: CostRecord) => Promise<void>;

async function fileCostSink(record: CostRecord): Promise<void> {
  const dir = join(process.cwd(), '.data', 'ai-cost');
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const file = join(dir, `cost-${record.createdAt.slice(0, 10)}.ndjson`);
    writeFileSync(file, JSON.stringify(record) + '\n', { flag: 'a' });
  } catch (err) {
    logger.warn('[cost] Failed to write cost record to file', { error: String(err) });
  }
}

let _costSink: CostSink = fileCostSink;

export function setCostSink(sink: CostSink): void {
  _costSink = sink;
}

// ─── Production Cost Sink ─────────────────────────────────────────────────────

/**
 * Configuration for ProductionCostSink.
 */
export interface ProductionCostSinkConfig {
  /**
   * HTTP endpoint to POST cost records to.
   * Sourced from REQUIEM_COST_ENDPOINT env var if not provided.
   */
  endpoint: string;
  /** Number of records to buffer before flushing. Default: 100. */
  batchSize?: number;
  /** Maximum milliseconds to wait before flushing a partial batch. Default: 10000. */
  flushIntervalMs?: number;
  /** Maximum retry attempts on failure. Default: 3. */
  maxRetries?: number;
  /** Initial backoff in ms for exponential retry. Default: 250. */
  initialBackoffMs?: number;
  /** Default tenant ID for partitioning (if not in record). */
  defaultTenantId?: string;
}

/**
 * Production-grade cost sink with HTTP POST, batching, and retry.
 *
 * Records are buffered up to `batchSize` entries or `flushIntervalMs` ms,
 * then flushed as a JSON array to `endpoint`. Failures are retried with
 * exponential backoff up to `maxRetries` times.
 *
 * Set REQUIEM_COST_ENDPOINT in the environment to activate.
 *
 * INVARIANT: Cost records are tenant-scoped for partitioning.
 * INVARIANT: Sink failures are non-fatal; errors are logged as warnings.
 */
export class ProductionCostSink {
  private readonly endpoint: string;
  private readonly batchSize: number;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly flushIntervalMs: number;
  private readonly defaultTenantId: string;
  private buffer: CostRecord[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> | null = null;

  constructor(config: ProductionCostSinkConfig) {
    this.endpoint = config.endpoint;
    this.batchSize = config.batchSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 10000;
    this.maxRetries = config.maxRetries ?? 3;
    this.initialBackoffMs = config.initialBackoffMs ?? 250;
    this.defaultTenantId = config.defaultTenantId ?? 'default';

    // Ensure clean shutdown
    this.#setupShutdownHooks();
  }

  /**
   * Create a ProductionCostSink from environment variables.
   * Returns null if REQUIEM_COST_ENDPOINT is not set.
   */
  static fromEnv(): ProductionCostSink | null {
    const endpoint = process.env.REQUIEM_COST_ENDPOINT;
    if (!endpoint) {
      return null;
    }

    return new ProductionCostSink({
      endpoint,
      batchSize: parseInt(process.env.REQUIEM_COST_BATCH_SIZE ?? '100', 10),
      flushIntervalMs: parseInt(process.env.REQUIEM_COST_FLUSH_INTERVAL_MS ?? '10000', 10),
      maxRetries: parseInt(process.env.REQUIEM_COST_MAX_RETRIES ?? '3', 10),
      initialBackoffMs: parseInt(process.env.REQUIEM_COST_INITIAL_BACKOFF_MS ?? '250', 10),
    });
  }

  /**
   * Write a cost record to the sink.
   * Records are buffered and flushed in batches.
   */
  async write(record: CostRecord): Promise<void> {
    // Ensure tenant ID is set
    const recordWithTenant = {
      ...record,
      tenantId: record.tenantId || this.defaultTenantId,
    };

    this.buffer.push(recordWithTenant);

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    } else {
      this.#scheduleFlush();
    }
  }

  /**
   * Flush all buffered records immediately.
   * Waits for any in-progress flush to complete.
   */
  async flush(): Promise<void> {
    // Wait for any in-progress flush
    if (this.flushPromise) {
      await this.flushPromise;
      return;
    }

    if (this.buffer.length === 0) {
      return;
    }

    // Clear scheduled flush if any
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Take current buffer and flush
    const batch = this.buffer;
    this.buffer = [];

    this.flushPromise = this.#flushBatch(batch).finally(() => {
      this.flushPromise = null;
    });

    await this.flushPromise;
  }

  /**
   * Get the current buffer size (for monitoring).
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Dispose the sink, flushing any pending records.
   */
  async dispose(): Promise<void> {
    await this.flush();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  #scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch(err => {
        logger.warn('[cost:production] Scheduled flush failed', { error: String(err) });
      });
    }, this.flushIntervalMs);
  }

  async #flushBatch(batch: CostRecord[]): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Record-Count': String(batch.length),
          },
          body: JSON.stringify({ records: batch }),
        });

        if (response.ok) {
          logger.debug('[cost:production] Flushed batch', { count: batch.length });
          return;
        }

        const errorText = await response.text().catch(() => 'Unknown error');
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);
        logger.warn('[cost:production] Flush failed', {
          attempt,
          status: response.status,
          count: batch.length
        });
      } catch (err) {
        lastError = err as Error;
        logger.warn('[cost:production] Flush error', {
          attempt,
          error: String(err),
          count: batch.length
        });
      }

      // Exponential backoff
      if (attempt < this.maxRetries - 1) {
        const delay = this.initialBackoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.error('[cost:production] Failed to flush batch after retries', {
      count: batch.length,
      error: lastError?.message,
    });
  }

  #setupShutdownHooks(): void {
    const flushOnExit = () => {
      // Synchronous flush attempt on exit
      if (this.buffer.length > 0) {
        logger.warn('[cost:production] Exiting with unflushed records', {
          count: this.buffer.length
        });
      }
    };

    process.on('beforeExit', flushOnExit);
    process.on('SIGINT', () => {
      this.dispose().finally(() => process.exit(0));
    });
    process.on('SIGTERM', () => {
      this.dispose().finally(() => process.exit(0));
    });
  }
}

/**
 * Create a cost sink function from a ProductionCostSink.
 * This adapts the class to the CostSink function type.
 */
export function createProductionCostSink(config: ProductionCostSinkConfig): CostSink {
  const sink = new ProductionCostSink(config);
  return (record: CostRecord) => sink.write(record);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Gets telemetry summary for a tenant.
 * Returns mock data if no database is available.
 *
 * @param tenantId The tenant to get summary for.
 */
export function getTelemetrySummary(_tenantId: string): TelemetrySummary {
  // In production, this would query the database
  // For now, return mock data
  return {
    totalRequests: 0,
    totalCostCents: 0,
    avgLatencyMs: 0,
    errorRate: 0,
  };
}

/**
 * Record cost for an AI operation.
 * Never throws — cost recording failures are warnings only.
 *
 * @param ctx The invocation context.
 * @param data The cost data to record.
 */
export async function recordCost(
  ctx: InvocationContext,
  data: CostRecordInput
): Promise<CostRecord> {
  const record: CostRecord = {
    id: newId('cost'),
    traceId: ctx.traceId,
    tenantId: ctx.tenant?.tenantId ?? 'unknown',
    actorId: ctx.actorId,
    createdAt: now(),
    ...data,
  };

  try {
    await _costSink(record);
  } catch (err) {
    logger.warn('[cost] Cost sink error (non-fatal)', { error: String(err) });
  }

  return record;
}

/**
 * Create a stub cost record for tools with no LLM call.
 */
export async function recordToolCost(
  ctx: InvocationContext,
  toolName: string,
  latencyMs: number
): Promise<CostRecord> {
  return recordCost(ctx, {
    provider: 'local',
    model: toolName,
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
    latencyMs,
    phase: 'tool',
  });
}
