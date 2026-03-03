import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    return NextResponse.json({
      ok: true,
      data: { total_cost_units: 0, p50: 0, p95: 0, tenant_id: ctx.tenant_id },
      trace_id: ctx.trace_id,
    });
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const policy = await req.json().catch(() => ({}));
    return NextResponse.json({ ok: true, updated: true, policy, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id }, { status: 200 });
  }, async () => {
    const role = req.headers.get('X-Requiem-Role') ?? 'viewer';
    return { allow: ['admin', 'operator'].includes(role), reasons: ['admin role required'] };
  });
}
