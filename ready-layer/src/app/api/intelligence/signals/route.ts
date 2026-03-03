import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { getSignals } from '@/lib/intelligence-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const severityParam = req.nextUrl.searchParams.get('severity');
    const severity = severityParam === 'INFO' || severityParam === 'WARN' || severityParam === 'CRITICAL'
      ? severityParam
      : undefined;
    const data = getSignals(ctx.tenant_id, severity);
    return NextResponse.json({ ok: true, v: 1, tenant_id: ctx.tenant_id, severity: severity ?? null, data, trace_id: ctx.trace_id }, { status: 200 });
  });
}
