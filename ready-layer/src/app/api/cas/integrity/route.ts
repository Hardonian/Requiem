import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { fetchCASIntegrity } from '@/lib/engine-client';
import type { CASIntegrityReport } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      try {
        const report = await fetchCASIntegrity({ tenant_id: ctx.tenant_id, auth_token: ctx.auth_token });
        const status = report.ok ? 200 : 206;
        return NextResponse.json(report satisfies CASIntegrityReport, { status });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'CAS Integrity Check Failed', msg, { code: 'cas_integrity_check_failed' });
      }
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'cas.integrity',
      rateLimit: { capacity: 1, refillPerSecond: 1 / 60, cost: 1 },
    },
  );
}
