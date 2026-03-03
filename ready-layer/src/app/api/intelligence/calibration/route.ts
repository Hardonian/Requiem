import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { assertValidCalibrationWindow, getCalibration } from '@/lib/intelligence-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const claimType = req.nextUrl.searchParams.get('claim_type') || undefined;
    const window = req.nextUrl.searchParams.get('window') || undefined;

    try {
      assertValidCalibrationWindow(window);
    } catch {
      return new Response(JSON.stringify({
        type: 'https://httpstatuses.com/400',
        title: 'Invalid Calibration Window',
        status: 400,
        detail: 'window must match <number><d|h> (example: 30d or 72h)',
        trace_id: ctx.trace_id,
      }), {
        status: 400,
        headers: { 'content-type': 'application/problem+json' },
      });
    }

    const data = getCalibration(ctx.tenant_id, claimType, window);
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, claim_type: claimType ?? null, window, data, trace_id: ctx.trace_id }, { status: 200 });
  });
}
