import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';
import { trainWeightsFromDataset } from '@/lib/learning-store';

const rowSchema = z.object({ feature_key: z.string(), feature_value: z.number(), actual: z.number() });
const bodySchema = z.object({
  model_id: z.string().min(1),
  seed: z.number().int().default(42),
  learning_rate: z.number().default(0.05),
  max_iters: z.number().int().default(50),
  dataset_rows: z.array(rowSchema).min(1),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const body = await parseJsonWithSchema(req, bodySchema);
    const result = trainWeightsFromDataset({
      tenant_id: ctx.tenant_id,
      model_id: body.model_id,
      dataset_rows: body.dataset_rows,
      seed: body.seed,
      learning_rate: body.learning_rate,
      max_iters: body.max_iters,
    });
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id, ...result }, { status: 200 });
  });
}
