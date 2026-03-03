import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { fetchClusterDrift } from '@/lib/engine-client';
import type { ClusterDriftResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      try {
        const drift = await fetchClusterDrift({ tenant_id: ctx.tenant_id, auth_token: ctx.auth_token });
        return NextResponse.json(drift satisfies ClusterDriftResponse, { status: 200 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Cluster Drift Unavailable', msg, { code: 'cluster_drift_unavailable' });
      }
    },
    async (ctx) => {
      const role = req.headers.get('x-requiem-role') ?? 'viewer';
      const auditorRoles = ['auditor', 'operator', 'admin'];
      if (ctx.actor_id === 'anonymous') return { allow: false, reasons: ['actor identity required'] };
      if (!auditorRoles.includes(role)) return { allow: false, reasons: [`rbac_denied:${role}`] };
      return { allow: true, reasons: [] };
    },
    {
      routeId: 'cluster.drift',
      cache: { ttlMs: 3000, visibility: 'private', staleWhileRevalidateMs: 3000 },
    },
  );
}
