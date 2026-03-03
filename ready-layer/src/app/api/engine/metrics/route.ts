import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { fetchEngineMetrics } from '@/lib/engine-client';
import type { EngineStats } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      try {
        const metrics = await fetchEngineMetrics({ tenant_id: ctx.tenant_id, auth_token: ctx.auth_token });
        return NextResponse.json(metrics satisfies EngineStats, { status: 200 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Engine Metrics Unavailable', msg, { code: 'engine_metrics_unavailable' });
      }
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'engine.metrics',
      cache: { ttlMs: 3000, visibility: 'private', staleWhileRevalidateMs: 3000 },
    },
  );
}
