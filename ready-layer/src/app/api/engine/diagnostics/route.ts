import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { fetchEngineDiagnostics } from '@/lib/engine-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      try {
        const diag = await fetchEngineDiagnostics({ tenant_id: ctx.tenant_id, auth_token: ctx.auth_token });
        return NextResponse.json(diag, { status: 200 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Engine Diagnostics Unavailable', msg, { code: 'engine_diagnostics_unavailable' });
      }
    },
    async () => {
      const role = req.headers.get('x-requiem-role') ?? 'viewer';
      const allowed = ['auditor', 'operator', 'admin'];
      return {
        allow: allowed.includes(role),
        reasons: allowed.includes(role) ? [] : [`rbac_denied:${role}`],
      };
    },
    {
      routeId: 'engine.diagnostics',
    },
  );
}
