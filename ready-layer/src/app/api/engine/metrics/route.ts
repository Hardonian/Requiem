// ready-layer/src/app/api/engine/metrics/route.ts
//
// Phase B+I: Engine metrics endpoint — /api/engine/metrics
// Serves complete metrics (p50/p95/p99 ms, CAS hit rate, determinism score,
// failure categories, memory, concurrency) for dashboard consumption.
// INVARIANT: No direct engine call. Proxies through Node API boundary.

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchEngineMetrics } from '@/lib/engine-client';
import type { EngineStats } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  try {
    const metrics = await fetchEngineMetrics(auth.tenant);
    return NextResponse.json(metrics satisfies EngineStats);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'engine_metrics_unavailable', detail: msg },
      { status: 502 },
    );
  }
}
