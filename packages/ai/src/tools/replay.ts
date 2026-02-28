/**
 * @fileoverview Replay cache and integrity system for the AI control-plane.
 *
 * INVARIANT: Replay records are append-only and content-addressed by execution hash.
 * INVARIANT: Replayed results are NEVER re-executed — only served from cache.
 * INVARIANT: Non-deterministic tools are marked non_replayable.
 * INVARIANT: Tampering with a replay record causes hash mismatch → reject.
 *
 * The replay hash is computed as:
 *   SHA-256(tool_name@version + ":" + input_hash + ":" + tenant_id + ":" + mode)
 *
 * Replay records also store a record integrity hash:
 *   SHA-256(execution_hash + result_json + created_at)
 * This prevents offline tampering with stored replay records.
 */

import { createHash } from 'crypto';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { logger } from '../telemetry/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplayRecord {
  /** Content-addressable execution hash */
  readonly hash: string;
  /** Tenant who owns this replay */
  readonly tenantId: string;
  readonly toolName: string;
  readonly toolVersion: string;
  /** SHA-256 of the serialized input */
  readonly inputHash: string;
  /** The cached result */
  readonly result: unknown;
  /** ISO timestamp of first execution */
  readonly createdAt: string;
  /** Integrity hash over hash+result+createdAt (anti-tamper) */
  readonly integrity: string;
}

export interface ReplaySink {
  get(hash: string, tenantId: string): Promise<ReplayRecord | undefined>;
  set(record: ReplayRecord): Promise<void>;
}

// ─── Integrity ────────────────────────────────────────────────────────────────

function computeIntegrity(hash: string, result: unknown, createdAt: string): string {
  const payload = `${hash}:${JSON.stringify(result)}:${createdAt}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

function verifyIntegrity(record: ReplayRecord): boolean {
  const expected = computeIntegrity(record.hash, record.result, record.createdAt);
  return expected === record.integrity;
}

// ─── File-Backed Sink ─────────────────────────────────────────────────────────

class FileReplaySink implements ReplaySink {
  private dir: string;

  constructor() {
    this.dir = join(process.cwd(), '.data', 'ai-replay');
  }

  private tenantFile(tenantId: string): string {
    const safe = tenantId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return join(this.dir, `replay-${safe}.ndjson`);
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }

  async get(hash: string, tenantId: string): Promise<ReplayRecord | undefined> {
    const file = this.tenantFile(tenantId);
    if (!existsSync(file)) return undefined;
    try {
      const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
      for (const line of lines) {
        const rec = JSON.parse(line) as ReplayRecord;
        if (rec.hash === hash && rec.tenantId === tenantId) {
          return rec;
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  async set(record: ReplayRecord): Promise<void> {
    this.ensureDir();
    const file = this.tenantFile(record.tenantId);
    writeFileSync(file, JSON.stringify(record) + '\n', { flag: 'a' });
  }
}

// ─── Global Sink ─────────────────────────────────────────────────────────────

let _sink: ReplaySink = new FileReplaySink();

export function setReplaySink(sink: ReplaySink): void {
  _sink = sink;
}

export function getReplaySink(): ReplaySink {
  return _sink;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check the replay cache for a given execution hash + tenant.
 * Verifies record integrity before returning.
 * Returns undefined on cache miss or integrity failure.
 */
export async function checkReplayCache(
  hash: string,
  tenantId: string
): Promise<ReplayRecord | undefined> {
  try {
    const record = await _sink.get(hash, tenantId);
    if (!record) return undefined;

    // Tenant isolation: reject if tenantId doesn't match
    if (record.tenantId !== tenantId) {
      logger.warn('[replay] tenant mismatch in replay record', {
        expected: tenantId,
        actual: record.tenantId,
        hash,
      });
      return undefined;
    }

    // Integrity check: reject tampered records
    if (!verifyIntegrity(record)) {
      logger.warn('[replay] integrity check failed — record may be tampered', { hash, tenant: tenantId });
      return undefined;
    }

    return record;
  } catch (err) {
    logger.warn('[replay] cache read error (non-fatal)', { error: String(err) });
    return undefined;
  }
}

/**
 * Store a new replay record with integrity hash.
 */
export async function storeReplayRecord(
  input: Omit<ReplayRecord, 'integrity'>
): Promise<void> {
  const integrity = computeIntegrity(input.hash, input.result, input.createdAt);
  const record: ReplayRecord = { ...input, integrity };

  try {
    await _sink.set(record);
  } catch (err) {
    // Replay storage failure is non-fatal — execution already succeeded
    logger.warn('[replay] failed to store replay record (non-fatal)', { error: String(err) });
  }
}

/**
 * Retrieve a replay record by ID for the `requiem replay <id>` CLI command.
 * Validates tenant isolation and integrity.
 * Throws AiError on tamper or not-found.
 */
export async function getReplayRecord(
  hash: string,
  tenantId: string
): Promise<ReplayRecord> {
  const record = await _sink.get(hash, tenantId);

  if (!record) {
    throw new AiError({
      code: AiErrorCode.REPLAY_NOT_FOUND,
      message: `No replay record found for hash: ${hash}`,
      phase: 'replay',
    });
  }

  if (record.tenantId !== tenantId) {
    throw new AiError({
      code: AiErrorCode.VECTOR_TENANT_MISMATCH,
      message: `Replay record belongs to a different tenant`,
      phase: 'replay',
    });
  }

  if (!verifyIntegrity(record)) {
    throw new AiError({
      code: AiErrorCode.REPLAY_TAMPERED,
      message: `Replay record integrity check failed — record may have been tampered with`,
      phase: 'replay',
    });
  }

  return record;
}

/**
 * In-memory replay sink for testing.
 */
export class InMemoryReplaySink implements ReplaySink {
  private store = new Map<string, ReplayRecord>();

  async get(hash: string, tenantId: string): Promise<ReplayRecord | undefined> {
    return this.store.get(`${tenantId}:${hash}`);
  }

  async set(record: ReplayRecord): Promise<void> {
    this.store.set(`${record.tenantId}:${record.hash}`, record);
  }

  clear(): void {
    this.store.clear();
  }
}
