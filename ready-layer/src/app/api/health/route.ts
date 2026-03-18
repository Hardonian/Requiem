// ready-layer/src/app/api/health/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import type { HealthResponse } from '@/types/engine';
import { isProductionLikeRuntime } from '@/lib/runtime-mode';
import { isSupabaseServiceConfigured } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async () => {
      const productionLike = isProductionLikeRuntime();
      const checks = [
        {
          name: 'engine_api_configured',
          ok: Boolean(process.env.REQUIEM_API_URL),
          message: process.env.REQUIEM_API_URL
            ? 'REQUIEM_API_URL configured'
            : productionLike
              ? 'REQUIEM_API_URL missing for production-like runtime'
              : 'REQUIEM_API_URL absent; local-only standby behavior is expected in development',
        },
        {
          name: 'tenant_auth_configured',
          ok: Boolean(process.env.REQUIEM_AUTH_SECRET),
          message: process.env.REQUIEM_AUTH_SECRET
            ? 'REQUIEM_AUTH_SECRET configured'
            : productionLike
              ? 'REQUIEM_AUTH_SECRET missing for strict runtime auth'
              : 'REQUIEM_AUTH_SECRET absent; only explicit development-only auth bypasses can work',
        },
        {
          name: 'shared_state_configured',
          ok: isSupabaseServiceConfigured(),
          message: isSupabaseServiceConfigured()
            ? 'Supabase shared state configured'
            : productionLike
              ? 'SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for durable shared state'
              : 'Shared Supabase state not configured; filesystem and memory fallbacks remain development-only',
        },
      ];

      const allOk = checks.every((check) => check.ok);
      const statusCode = productionLike && !allOk ? 503 : 200;
      const body: HealthResponse = {
        ok: allOk,
        status: allOk ? 'healthy' : productionLike ? 'unhealthy' : 'degraded',
        engine_version: process.env.REQUIEM_ENGINE_VERSION ?? 'unknown',
        timestamp_unix_ms: Date.now(),
        checks,
      };

      return NextResponse.json(body, { status: statusCode });
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
