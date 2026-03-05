import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { getDashboard } from '@/lib/learning-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const data = getDashboard(ctx.tenant_id);
    return NextResponse.json({ ok: true, v: 1, trace_id: ctx.trace_id, data }, { status: 200 });
  });
}
