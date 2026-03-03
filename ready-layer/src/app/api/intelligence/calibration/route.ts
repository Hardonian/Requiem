import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { getCalibration } from '@/lib/intelligence-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const claimType = req.nextUrl.searchParams.get('claim_type') || undefined;
    const window = req.nextUrl.searchParams.get('window') || undefined;
    const data = getCalibration(ctx.tenant_id, claimType, window);
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, claim_type: claimType ?? null, window, data, trace_id: ctx.trace_id }, { status: 200 });
  });
}
