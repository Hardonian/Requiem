import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { getDataset } from '@/lib/foundry-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return withTenantContext(request, async (ctx) => {
    const { id } = await params;
    const dataset = getDataset(id);
    if (!dataset) {
      return new Response(JSON.stringify({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: `Dataset ${id} not found`,
        trace_id: ctx.trace_id,
      }), { status: 404, headers: { 'content-type': 'application/problem+json' } });
    }
    return NextResponse.json({ v: 1, ok: true, data: dataset, trace_id: ctx.trace_id }, { status: 200 });
  });
}
