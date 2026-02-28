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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record cost for an AI operation.
 * Never throws — cost recording failures are warnings only.
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
