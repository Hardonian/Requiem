import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const q = new URL(req.url).searchParams.get('q') ?? '';
    return NextResponse.json({ ok: true, data: [], query: q, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id }, { status: 200 });
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ ok: true, published: false, reason: 'registry_publish_scaffold', body, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id }, { status: 202 });
  }, async (ctx) => ({ allow: ctx.actor_id !== 'anonymous', reasons: ctx.actor_id === 'anonymous' ? ['actor identity required'] : [] }));
}
