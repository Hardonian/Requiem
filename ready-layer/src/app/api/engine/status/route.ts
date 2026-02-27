// ready-layer/src/app/api/engine/status/route.ts
//
// Phase B: Engine status endpoint — /api/engine/status
// Requires tenant auth. Returns runtime engine status + worker identity + metrics.
// INVARIANT: No direct engine call. Proxies through Node API boundary via engine-client.

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchEngineStatus } from '@/lib/engine-client';
import type { EngineStatusResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  try {
    const status = await fetchEngineStatus(auth.tenant);
    return NextResponse.json(status satisfies EngineStatusResponse);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'engine_status_unavailable', detail: msg },
      { status: 502 },
    );
  }
}
