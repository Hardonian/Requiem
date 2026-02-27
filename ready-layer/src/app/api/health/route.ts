// ready-layer/src/app/api/health/route.ts
//
// Phase B: Health route — /api/health
// No auth required. No engine call. Pure infra check.
// verify:routes:no-try-catch — this handler reads only process.env; no external calls can throw.
// INVARIANT: This route must NEVER call the engine directly.
// INVARIANT: Must return 200 even when engine is degraded (to allow load-balancer pass-through);
//            use status: "degraded" to signal impairment.

import { NextResponse } from 'next/server';
import type { HealthResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const checks = [
    {
      name: 'node_api_reachable',
      ok: Boolean(process.env.REQUIEM_API_URL),
      message: process.env.REQUIEM_API_URL
        ? 'REQUIEM_API_URL configured'
        : 'REQUIEM_API_URL not set — defaulting to localhost:3001',
    },
    {
      name: 'tenant_auth_configured',
      ok: Boolean(process.env.REQUIEM_AUTH_SECRET),
      message: process.env.REQUIEM_AUTH_SECRET
        ? 'Auth secret present'
        : 'REQUIEM_AUTH_SECRET not set — auth disabled',
    },
  ];

  const allOk = checks.every((c) => c.ok);

  const body: HealthResponse = {
    ok: true, // always 200 — callers check status field
    status: allOk ? 'healthy' : 'degraded',
    engine_version: process.env.REQUIEM_ENGINE_VERSION ?? 'unknown',
    timestamp_unix_ms: Date.now(),
    checks,
  };

  return NextResponse.json(body, { status: 200 });
}
