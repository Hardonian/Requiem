import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { fetchEngineStatus } from '@/lib/engine-client';
import type { EngineStatusResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      try {
        const status = await fetchEngineStatus({ tenant_id: ctx.tenant_id, auth_token: ctx.auth_token });
        return NextResponse.json(status satisfies EngineStatusResponse, { status: 200 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Engine Status Unavailable', msg, { code: 'engine_status_unavailable' });
      }
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'engine.status',
      cache: { ttlMs: 5000, visibility: 'private', staleWhileRevalidateMs: 5000 },
    },
  );
}
