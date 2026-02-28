/**
 * @fileoverview Cost and token accounting for AI operations.
 */

import { z } from 'zod';
import { getDB } from '@requiem/cli'; // Assuming this path
import { InvocationContext } from '../policy/gate';

// #region: Core Types

export const CostRecordSchema = z.object({
  id: z.string(),
  traceId: z.string(),
  tenantId: z.string(),
  actorId: z.string(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costCents: z.number().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type CostRecord = z.infer<typeof CostRecordSchema>;

// #endregion: Core Types


// #region: Public API

/**
 * Records a cost entry for an AI operation.
 *
 * @param ctx The invocation context.
 * @param data The cost data to record.
 */
export async function recordCost(
  ctx: InvocationContext,
  data: Omit<CostRecord, 'id' | 'traceId' | 'tenantId' | 'actorId' | 'createdAt'>
): Promise<CostRecord> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = newId('cost'); // Assuming newId is available

  const record: CostRecord = {
    id,
    traceId: ctx.traceId,
    tenantId: ctx.tenant.id,
    actorId: ctx.actorId,
    createdAt: now,
    ...data,
  };
  
  CostRecordSchema.parse(record);

  const stmt = db.prepare(`
    INSERT INTO ai_cost_records (
      id, traceId, tenantId, actorId, provider, model, inputTokens, outputTokens,
      costCents, latencyMs, createdAt
    ) VALUES (
      @id, @traceId, @tenantId, @actorId, @provider, @model, @inputTokens, @outputTokens,
      @costCents, @latencyMs, @createdAt
    )
  `);

  stmt.run(record);
  return record;
}

// #endregion: Public API
