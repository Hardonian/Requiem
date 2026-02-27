// ready-layer/src/app/api/engine/diagnostics/route.ts
//
// Phase B: Engine diagnostics endpoint — /api/engine/diagnostics
// Returns full diagnostic report: version manifest, hash health, CAS summary,
// sandbox capabilities, recent failure events.
// INVARIANT: SRE/Security Auditor persona access only — requires elevated role claim.
// INVARIANT: No direct engine call. Proxies through Node API boundary.

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchEngineDiagnostics } from '@/lib/engine-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  try {
    const diag = await fetchEngineDiagnostics(auth.tenant);
    return NextResponse.json(diag);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'engine_diagnostics_unavailable', detail: msg },
      { status: 502 },
    );
  }
}
