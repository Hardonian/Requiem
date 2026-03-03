import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { listDatasets } from '@/lib/foundry-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(request, async (ctx) => {
    return NextResponse.json({ v: 1, ok: true, data: listDatasets(), trace_id: ctx.trace_id }, { status: 200 });
  });
}
