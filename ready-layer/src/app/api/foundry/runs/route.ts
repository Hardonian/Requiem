import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { listRuns } from '@/lib/foundry-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(request, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get('dataset_id') ?? undefined;
    return NextResponse.json({ v: 1, ok: true, data: listRuns(datasetId), trace_id: ctx.trace_id }, { status: 200 });
  });
}
