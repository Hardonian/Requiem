// ready-layer/src/app/api/replay/verify/route.ts
//
// Phase B+E: Replay verify endpoint — /api/replay/verify
// Triggers deterministic replay verification for a specific execution_id.
// Returns structured verification result with divergence details.
// INVARIANT: No direct engine call. Proxies through Node API boundary.

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { verifyReplay } from '@/lib/engine-client';
import type { ReplayVerifyResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  const execution_id = req.nextUrl.searchParams.get('execution_id');
  if (!execution_id) {
    return NextResponse.json(
      { ok: false, error: 'missing_param', detail: 'execution_id query parameter required' },
      { status: 400 },
    );
  }

  try {
    const result = await verifyReplay(auth.tenant, execution_id);
    const status = result.verified ? 200 : 409; // 409 = replay divergence detected
    return NextResponse.json(result satisfies ReplayVerifyResponse, { status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'replay_verify_failed', detail: msg },
      { status: 502 },
    );
  }
}
