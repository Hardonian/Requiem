import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { getCases } from '@/lib/intelligence-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const data = getCases(ctx.tenant_id);
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, data, trace_id: ctx.trace_id }, { status: 200 });
  });
}
