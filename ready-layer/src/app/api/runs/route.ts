import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { writeAudit } from '@/lib/big4-audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '25', 10), 100);
      const offset = Math.max(Number.parseInt(searchParams.get('offset') ?? '0', 10), 0);
      const runs = Array.from({ length: Math.min(limit, 10) }, (_, index) => ({
        run_id: `run_${ctx.tenant_id}_${offset + index}`,
        tenant_id: ctx.tenant_id,
        status: 'ok',
        created_at: new Date(Date.now() - index * 10_000).toISOString(),
      }));

      await writeAudit({
        tenant_id: ctx.tenant_id,
        actor_id: ctx.actor_id,
        request_id: ctx.request_id,
        trace_id: ctx.trace_id,
        event_type: 'RUN_CREATED',
        payload: { route: '/api/runs', limit, offset, returned: runs.length },
      });

      return NextResponse.json({ v: 1, ok: true, data: runs, trace_id: ctx.trace_id }, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'runs.list',
      cache: { ttlMs: 5000, visibility: 'private', staleWhileRevalidateMs: 5000 },
    },
  );
}
