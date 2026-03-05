import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { buildErrorBands, getLatestErrorBands } from '@/lib/learning-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const model_id = req.nextUrl.searchParams.get('model_id') || undefined;
    const result = getLatestErrorBands(ctx.tenant_id, model_id);
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id, model_id: model_id ?? null, ...result }, { status: 200 });
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const model_id = req.nextUrl.searchParams.get('model_id') || 'model-default';
    const mc = Number(req.nextUrl.searchParams.get('mc') || '200');
    const result = buildErrorBands(ctx.tenant_id, model_id, mc);
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id, model_id, ...result }, { status: 200 });
  });
}
