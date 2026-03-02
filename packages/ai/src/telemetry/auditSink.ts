/**
 * @fileoverview Audit sink abstraction for durable audit log persistence (S-9/S-12).
 *
 * Provides an abstract AuditSink interface with concrete implementations:
 *   - InMemoryAuditSink  — in-memory only (for tests)
 *   - FileAuditSink      — local NDJSON file (for dev)
 *   - DatabaseAuditSink  — HTTP POST to configurable endpoint with batch/retry (for prod)
 *   - CompositeSink      — fan-out to multiple sinks simultaneously
 *
 * INVARIANTS:
 *   - Audit records are append-only.
 *   - All records include tenant_id for RLS-ready partitioning.
 *   - Sink failures are non-fatal; errors are logged as warnings.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';
import type { ToolAuditRecord } from '../tools/types.js';

// ─── Extended Audit Record (RLS-ready) ───────────────────────────────────────

/**
 * Audit record extended with tenant_id for RLS (Row-Level Security) partitioning.
 * All audit writes should include tenant_id when available.
 */
export interface TenantAuditRecord extends ToolAuditRecord {
  /** Tenant identifier for RLS-ready partitioning. Empty string means system-level. */
  tenant_id: string;
  /** Merkle chain hash for this entry (populated when merkle_audit_chain flag is enabled). */
  chain_hash?: string;
}

// ─── Abstract Sink Interface ──────────────────────────────────────────────────

/**
 * Abstract audit sink interface.
 * All implementations must be non-throwing — errors are swallowed after logging.
 */
export interface IAuditSink {
  /** Write a single audit record. Never throws. */
  write(record: TenantAuditRecord): Promise<void>;
  /** Flush any buffered records. Never throws. */
  flush(): Promise<void>;
  /** Human-readable name of this sink (for AUDIT_PERSISTENCE reporting). */
  readonly name: string;
}

// ─── InMemoryAuditSink ────────────────────────────────────────────────────────

/**
 * In-memory audit sink for tests.
 * Records are stored in a plain array and never persisted.
 */
export class InMemoryAuditSink implements IAuditSink {
  readonly name = 'memory';
  private _records: TenantAuditRecord[] = [];

  async write(record: TenantAuditRecord): Promise<void> {
    this._records.push(record);
  }

  async flush(): Promise<void> {
    // No-op — memory is already immediately visible.
  }

  /** Return a copy of all stored records (for test assertions). */
  getRecords(): TenantAuditRecord[] {
    return [...this._records];
  }

  /** Clear all stored records (for test teardown). */
  clear(): void {
    this._records = [];
  }
}

// ─── FileAuditSink ────────────────────────────────────────────────────────────

/**
 * File-backed NDJSON audit sink for development.
 * Writes one JSON record per line to .data/ai-audit/audit-<date>.ndjson.
 */
export class FileAuditSink implements IAuditSink {
  readonly name = 'file';
  private readonly _dir: string;

  constructor(dir?: string) {
    this._dir = dir ?? join(process.cwd(), '.data', 'ai-audit');
  }

  async write(record: TenantAuditRecord): Promise<void> {
    try {
      if (!existsSync(this._dir)) mkdirSync(this._dir, { recursive: true });
      const file = join(this._dir, `audit-${record.timestamp.slice(0, 10)}.ndjson`);
      writeFileSync(file, JSON.stringify(record) + '\n', { flag: 'a' });
    } catch (err) {
      logger.warn('[audit:file] Failed to write audit record', { error: String(err) });
    }
  }

  async flush(): Promise<void> {
    // Synchronous writes are already flushed.
  }
}

// ─── DatabaseAuditSink ────────────────────────────────────────────────────────

/**
 * Configuration for DatabaseAuditSink.
 */
export interface DatabaseAuditSinkConfig {
  /**
   * HTTP endpoint to POST audit records to.
   * Sourced from REQUIEM_AUDIT_ENDPOINT env var if not provided.
   */
  endpoint: string;
  /** Number of records to buffer before flushing. Default: 50. */
  batchSize?: number;
  /** Maximum milliseconds to wait before flushing a partial batch. Default: 5000. */
  flushIntervalMs?: number;
  /** Maximum retry attempts on failure. Default: 3. */
  maxRetries?: number;
  /** Initial backoff in ms for exponential retry. Default: 250. */
  initialBackoffMs?: number;
}

/**
 * Database-backed audit sink using HTTP POST with batching and retry.
 *
 * Records are buffered up to `batchSize` entries or `flushIntervalMs` ms,
 * then flushed as a JSON array to `endpoint`. Failures are retried with
 * exponential backoff up to `maxRetries` times.
 *
 * Set REQUIEM_AUDIT_ENDPOINT in the environment to activate.
 */
export class DatabaseAuditSink implements IAuditSink {
  readonly name = 'database';
  private readonly _endpoint: string;
  private readonly _batchSize: number;
  private readonly _maxRetries: number;
  private readonly _initialBackoffMs: number;
  private _buffer: TenantAuditRecord[] = [];
  private _flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _flushIntervalMs: number;

  constructor(config: DatabaseAuditSinkConfig) {
    this._endpoint = config.endpoint;
    this._batchSize = config.batchSize ?? 50;
    this._flushIntervalMs = config.flushIntervalMs ?? 5000;
    this._maxRetries = config.maxRetries ?? 3;
    this._initialBackoffMs = config.initialBackoffMs ?? 250;
    this._scheduleFlush();
  }

  /** Load config from environment variable REQUIEM_AUDIT_ENDPOINT. */
  static fromEnv(): DatabaseAuditSink | null {
    const endpoint = process.env['REQUIEM_AUDIT_ENDPOINT'];
    if (!endpoint) return null;
    return new DatabaseAuditSink({ endpoint });
  }

  async write(record: TenantAuditRecord): Promise<void> {
    this._buffer.push(record);
    if (this._buffer.length >= this._batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    if (this._buffer.length === 0) {
      this._scheduleFlush();
      return;
    }
    const batch = this._buffer.splice(0, this._buffer.length);
    await this._sendWithRetry(batch);
    this._scheduleFlush();
  }

  private _scheduleFlush(): void {
    if (this._flushTimer) clearTimeout(this._flushTimer);
    this._flushTimer = setTimeout(() => {
      this.flush().catch((e) =>
        logger.warn('[audit:database] Background flush error', { error: String(e) })
      );
    }, this._flushIntervalMs);
    // Don't block process exit:
    if (this._flushTimer && typeof this._flushTimer === 'object' && 'unref' in this._flushTimer) {
      (this._flushTimer as NodeJS.Timeout).unref();
    }
  }

  private async _sendWithRetry(batch: TenantAuditRecord[]): Promise<void> {
    let backoff = this._initialBackoffMs;
    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      try {
        const res = await fetch(this._endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: batch }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return;
      } catch (err) {
        if (attempt === this._maxRetries) {
          logger.warn('[audit:database] All retry attempts failed; audit records dropped', {
            error: String(err),
            dropped: batch.length,
          });
          return;
        }
        logger.warn(`[audit:database] Attempt ${attempt + 1} failed, retrying in ${backoff}ms`, {
          error: String(err),
        });
        await new Promise((resolve) => setTimeout(resolve, backoff));
        backoff = Math.min(backoff * 2, 30_000);
      }
    }
  }
}

// ─── CompositeSink ────────────────────────────────────────────────────────────

/**
 * Fan-out sink that writes to multiple sinks simultaneously.
 * Each sink failure is isolated — other sinks still receive the record.
 */
export class CompositeSink implements IAuditSink {
  readonly name: string;
  private readonly _sinks: IAuditSink[];

  constructor(...sinks: IAuditSink[]) {
    this._sinks = sinks;
    this.name = `composite(${sinks.map((s) => s.name).join('+')})`;
  }

  async write(record: TenantAuditRecord): Promise<void> {
    await Promise.allSettled(this._sinks.map((s) => s.write(record)));
  }

  async flush(): Promise<void> {
    await Promise.allSettled(this._sinks.map((s) => s.flush()));
  }
}

// ─── Sink Factory ─────────────────────────────────────────────────────────────

/**
 * Create the default audit sink based on environment.
 * - Production (NODE_ENV=production): DatabaseAuditSink + FileAuditSink (composite)
 *   if REQUIEM_AUDIT_ENDPOINT is set; FileAuditSink otherwise.
 * - Development / test: FileAuditSink.
 *
 * @returns The recommended sink for the current environment.
 */
export function createDefaultAuditSink(): IAuditSink {
  const isProd = process.env['NODE_ENV'] === 'production';
  const dbSink = DatabaseAuditSink.fromEnv();

  if (isProd && dbSink) {
    logger.info('[audit] Using composite sink: database + file');
    return new CompositeSink(dbSink, new FileAuditSink());
  }

  if (dbSink) {
    logger.info('[audit] Using database audit sink');
    return dbSink;
  }

  logger.info('[audit] Using file audit sink');
  return new FileAuditSink();
}
