// ready-layer/src/app/api/engine/autotune/route.ts
//
// GET  /api/engine/autotune — Read current auto-tuning state and recent events.
// POST /api/engine/autotune — Trigger a manual auto-tune tick or revert.
//
// INVARIANT (INV-7): All errors return structured JSON body.
// INVARIANT (INV-6): No engine logic here — proxies via engine-client.
// INVARIANT: Auto-tuning never changes hash semantics or observable output.
// INVARIANT: export const dynamic = 'force-dynamic' required (INV-7).
//
// RBAC:
//   GET  — operator+ (engine_metrics_read)
//   POST — admin only (cluster_config_change) — revert_to_baseline action

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchAutotuneState, postAutotuneTick } from '@/lib/engine-client';
import type { AutotuneState } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  const role = req.headers.get('X-Requiem-Role') ?? 'viewer';
  const operatorRoles = ['operator', 'admin'];
  if (!operatorRoles.includes(role)) {
    return NextResponse.json(
      { ok: false, error: 'rbac_denied', required_role: 'operator', actual_role: role },
      { status: 403 },
    );
  }

  try {
    const state = await fetchAutotuneState(auth.tenant);
    return NextResponse.json(state satisfies AutotuneState);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'autotune_unavailable', detail: msg },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  // Admin-only for revert actions.
  const role = req.headers.get('X-Requiem-Role') ?? 'viewer';
  if (role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'rbac_denied', required_role: 'admin', actual_role: role },
      { status: 403 },
    );
  }

  let body: { action?: string } = {};
  try {
    body = await req.json() as { action?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', detail: 'Expected JSON body with action field' },
      { status: 400 },
    );
  }

  const action = body.action ?? 'tick';
  if (!['tick', 'revert'].includes(action)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_action', detail: 'action must be "tick" or "revert"' },
      { status: 400 },
    );
  }

  try {
    const result = await postAutotuneTick(auth.tenant, action);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'autotune_action_failed', detail: msg },
      { status: 502 },
    );
  }
}
