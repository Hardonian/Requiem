import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { getRun } from '@/lib/foundry-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const { id } = await params;
      const run = getRun(id);
      if (!run) {
        throw new ProblemError(404, 'Not Found', `Run ${id} not found`, { code: 'run_not_found' });
      }
      return NextResponse.json({ v: 1, ok: true, data: run, trace_id: ctx.trace_id }, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.runs.get',
      cache: { ttlMs: 15_000, visibility: 'private', staleWhileRevalidateMs: 15_000 },
    },
  );
}
