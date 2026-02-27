// ready-layer/src/app/api/audit/logs/route.ts
//
// Phase F+E: Audit log export endpoint — /api/audit/logs
// Returns recent execution provenance records from the immutable audit log.
// Enterprise Operator persona: export audit logs, inspect provenance.
// INVARIANT: No direct engine call. Proxies through Node API boundary.
// INVARIANT: Audit logs are read-only — no DELETE or PUT methods on this route.

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchAuditLogs } from '@/lib/engine-client';
import type { AuditLogEntry } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 1000) : 50;

  try {
    const entries = await fetchAuditLogs(auth.tenant, limit);
    return NextResponse.json({
      ok: true,
      count: entries.length,
      entries: entries satisfies AuditLogEntry[],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'audit_log_unavailable', detail: msg },
      { status: 502 },
    );
  }
}
