import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { fetchClusterDrift } from '@/lib/engine-client';
import type { ClusterDriftResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async (ctx) => {
    const tenant = { tenant_id: ctx.tenant_id, auth_token: req.headers.get('authorization') ?? '' };
    try {
      const drift = await fetchClusterDrift(tenant);
      return NextResponse.json(drift satisfies ClusterDriftResponse, { status: 200 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      return NextResponse.json({ ok: false, error: 'cluster_drift_unavailable', detail: msg, trace_id: ctx.trace_id }, { status: 502 });
    }
  }, async (ctx) => {
    const role = req.headers.get('X-Requiem-Role') ?? 'viewer';
    const auditorRoles = ['auditor', 'operator', 'admin'];
    if (ctx.actor_id === 'anonymous') return { allow: false, reasons: ['actor identity required'] };
    if (!auditorRoles.includes(role)) return { allow: false, reasons: [`rbac_denied:${role}`] };
    return { allow: true, reasons: [] };
  });
}
