// ready-layer/src/app/api/health/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import type { HealthResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async () => {
      const checks = [
        {
          name: 'node_api_reachable',
          ok: Boolean(process.env.REQUIEM_API_URL),
          message: process.env.REQUIEM_API_URL
            ? 'REQUIEM_API_URL configured'
            : 'REQUIEM_API_URL not set - defaulting to localhost:3001',
        },
        {
          name: 'tenant_auth_configured',
          ok: Boolean(process.env.REQUIEM_AUTH_SECRET),
          message: process.env.REQUIEM_AUTH_SECRET
            ? 'Auth secret present'
            : 'REQUIEM_AUTH_SECRET not set - auth disabled',
        },
      ];

      const allOk = checks.every((check) => check.ok);

      const body: HealthResponse = {
        ok: true,
        status: allOk ? 'healthy' : 'degraded',
        engine_version: process.env.REQUIEM_ENGINE_VERSION ?? 'unknown',
        timestamp_unix_ms: Date.now(),
        checks,
      };

      return NextResponse.json(body, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      requireAuth: false,
      routeId: 'health',
      rateLimit: false,
      cache: { ttlMs: 15_000, visibility: 'public', staleWhileRevalidateMs: 15_000 },
    },
  );
}
