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
      const body: HealthResponse = {
        ok: true,
        status: 'healthy',
        engine_version: process.env.REQUIEM_ENGINE_VERSION ?? 'unknown',
        timestamp_unix_ms: Date.now(),
        checks: [
          {
            name: 'app_process_alive',
            ok: true,
            message: `process ${process.pid} is serving requests`,
          },
        ],
      };

      return NextResponse.json(body, { status: statusCode });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      requireAuth: false,
      routeId: 'health',
      rateLimit: false,
      cache: { ttlMs: 5_000, visibility: 'public', staleWhileRevalidateMs: 5_000 },
    },
  );
}
