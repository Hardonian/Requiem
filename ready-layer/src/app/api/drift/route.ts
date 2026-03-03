import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    return NextResponse.json({ ok: true, data: { vectors: [], latest_status: 'stable' }, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id }, { status: 200 });
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const vector = await req.json().catch(() => ({}));
    return NextResponse.json({ ok: true, created: true, vector, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id }, { status: 201 });
  }, async (ctx) => ({ allow: ctx.actor_id !== 'anonymous', reasons: ctx.actor_id === 'anonymous' ? ['actor identity required'] : [] }));
}
