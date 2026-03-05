import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';
import { trainCalibrationFromDataset } from '@/lib/learning-store';

const rowSchema = z.object({ predicted: z.number(), raw_score: z.number(), actual: z.number() });
const bodySchema = z.object({
  model_id: z.string().min(1),
  method: z.enum(['platt', 'isotonic', 'bayesian_beta', 'none']).default('platt'),
  seed: z.number().int().default(42),
  dataset_rows: z.array(rowSchema).min(1),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const body = await parseJsonWithSchema(req, bodySchema);
    const result = trainCalibrationFromDataset({
      tenant_id: ctx.tenant_id,
      model_id: body.model_id,
      method: body.method,
      dataset_rows: body.dataset_rows,
      seed: body.seed,
    });
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id, ...result }, { status: 200 });
  });
}
