import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { getRun } from '@/lib/foundry-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return withTenantContext(request, async (ctx) => {
    const { id } = await params;
    const run = getRun(id);
    if (!run) {
      return new Response(JSON.stringify({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: `Run ${id} not found`,
        trace_id: ctx.trace_id,
      }), { status: 404, headers: { 'content-type': 'application/problem+json' } });
    }
    return NextResponse.json({ v: 1, ok: true, data: run, trace_id: ctx.trace_id }, { status: 200 });
  });
}
