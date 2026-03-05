import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';
import { addOutcomeEvent } from '@/lib/learning-store';

const bodySchema = z.object({
  prediction_event_cas: z.string().min(1),
  actual: z.number(),
  outcome_source: z.string().min(1).default('api'),
  outcome_refs: z.array(z.string()).default([]),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const body = await parseJsonWithSchema(req, bodySchema);
    const result = addOutcomeEvent({
      tenant_id: ctx.tenant_id,
      trace_id: ctx.trace_id,
      prediction_event_cas: body.prediction_event_cas,
      actual: body.actual,
      outcome_source: body.outcome_source,
      outcome_refs: body.outcome_refs,
    });
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id, ...result }, { status: 200 });
  });
}
