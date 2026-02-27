// ready-layer/src/app/api/engine/analyze/route.ts
//
// GET /api/engine/analyze — AI-assisted root cause diagnostics.
//
// Captures the current engine diagnostic context and runs the
// rule-based failure analyzer. Returns a structured DiagnosticReport
// with:
//   - failure category (determinism_drift, cluster_mismatch, etc.)
//   - supporting evidence (from engine stats, cluster state, versions)
//   - ordered remediation suggestions
//
// INVARIANT (INV-7): All errors return structured JSON body.
// INVARIANT (INV-6): No engine logic here — proxies via engine-client.
// INVARIANT: Diagnostics are READ-ONLY. This endpoint never modifies state.
// INVARIANT: export const dynamic = 'force-dynamic' required (INV-7).
//
// RBAC: auditor+ required (engine_analyze_read permission).

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchEngineAnalysis } from '@/lib/engine-client';
import type { DiagnosticReport } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  // RBAC: auditor role required for diagnostic analysis.
  const role = req.headers.get('X-Requiem-Role') ?? 'viewer';
  const auditorRoles = ['auditor', 'operator', 'admin'];
  if (!auditorRoles.includes(role)) {
    return NextResponse.json(
      { ok: false, error: 'rbac_denied', required_role: 'auditor', actual_role: role },
      { status: 403 },
    );
  }

  // Optional: accept error_code and error_detail as query params for targeted analysis.
  const errorCode   = req.nextUrl.searchParams.get('error_code')   ?? '';
  const errorDetail = req.nextUrl.searchParams.get('error_detail')  ?? '';

  try {
    const report = await fetchEngineAnalysis(auth.tenant, errorCode, errorDetail);
    return NextResponse.json(report satisfies DiagnosticReport);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'engine_analyze_unavailable', detail: msg },
      { status: 502 },
    );
  }
}
