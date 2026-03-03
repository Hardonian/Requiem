import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { getPredictions } from '@/lib/intelligence-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const runId = req.nextUrl.searchParams.get('run_id') || undefined;
    const data = getPredictions(ctx.tenant_id, runId);
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, run_id: runId ?? null, data, trace_id: ctx.trace_id }, { status: 200 });
  });
}
