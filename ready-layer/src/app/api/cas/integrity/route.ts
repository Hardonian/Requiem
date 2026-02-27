// ready-layer/src/app/api/cas/integrity/route.ts
//
// Phase B: CAS integrity check endpoint — /api/cas/integrity
// Triggers CAS object verification across all stored objects for this tenant.
// Returns per-object integrity status, corruption count, and overall health.
// INVARIANT: No direct engine call. Proxies through Node API boundary.
// INVARIANT: This endpoint is rate-limited to 1 request per minute per tenant
//            to prevent accidental DoS via repeated full-scan triggers.

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchCASIntegrity } from '@/lib/engine-client';
import type { CASIntegrityReport } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  try {
    const report = await fetchCASIntegrity(auth.tenant);
    const status = report.ok ? 200 : 206; // 206 = integrity issues found but not a server error
    return NextResponse.json(report satisfies CASIntegrityReport, { status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'cas_integrity_check_failed', detail: msg },
      { status: 502 },
    );
  }
}
