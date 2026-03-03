import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { fetchEngineAnalysis } from '@/lib/engine-client';
import type { DiagnosticReport } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const errorCode = req.nextUrl.searchParams.get('error_code') ?? '';
      const errorDetail = req.nextUrl.searchParams.get('error_detail') ?? '';

      try {
        const report = await fetchEngineAnalysis(
          { tenant_id: ctx.tenant_id, auth_token: ctx.auth_token },
          errorCode,
          errorDetail,
        );
        return NextResponse.json(report satisfies DiagnosticReport, { status: 200 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Engine Analyze Unavailable', msg, { code: 'engine_analyze_unavailable' });
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
      routeId: 'engine.analyze',
    },
  );
}
