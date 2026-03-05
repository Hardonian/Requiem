import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { buildCrosstab, getLatestCrosstab } from '@/lib/learning-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const window = req.nextUrl.searchParams.get('window') || '30d';
    const result = getLatestCrosstab(ctx.tenant_id, window);
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id, window, ...result }, { status: 200 });
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const window = req.nextUrl.searchParams.get('window') || '30d';
    const result = buildCrosstab(ctx.tenant_id, window);
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id, window, ...result }, { status: 200 });
  });
}
