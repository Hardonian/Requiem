import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { fetchClusterWorkers } from '@/lib/engine-client';
import type { ClusterWorkersResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      try {
        const workers = await fetchClusterWorkers({ tenant_id: ctx.tenant_id, auth_token: ctx.auth_token });
        return NextResponse.json(workers satisfies ClusterWorkersResponse, { status: 200 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Cluster Workers Unavailable', msg, { code: 'cluster_workers_unavailable' });
      }
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'cluster.workers',
      cache: { ttlMs: 3000, visibility: 'private', staleWhileRevalidateMs: 3000 },
    },
  );
}
