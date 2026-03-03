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
import { NextResponse } from 'next/server';
import { loadCalibrationReport } from '@/lib/calibration-report';

export const dynamic = 'force-dynamic';

function traceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(): Promise<NextResponse> {
  const t = traceId();
  try {
    const data = loadCalibrationReport();
    return NextResponse.json({ ok: true, data, trace_id: t }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      type: 'about:blank',
      title: 'Calibration data unavailable',
      status: 500,
      detail: error instanceof Error ? error.message : 'unknown_error',
      trace_id: t,
    }, { status: 500, headers: { 'content-type': 'application/problem+json' } });
  }
}
