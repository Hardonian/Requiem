import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { getDataset } from '@/lib/foundry-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const { id } = await params;
      const dataset = getDataset(id);
      if (!dataset) {
        throw new ProblemError(404, 'Not Found', `Dataset ${id} not found`, { code: 'dataset_not_found' });
      }
      return NextResponse.json({ v: 1, ok: true, data: dataset, trace_id: ctx.trace_id }, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.datasets.get',
      cache: { ttlMs: 15_000, visibility: 'private', staleWhileRevalidateMs: 15_000 },
    },
  );
}
