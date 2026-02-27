// ready-layer/src/app/api/cluster/drift/route.ts
//
// GET /api/cluster/drift — Cluster-level version drift and replay drift status.
//
// Returns:
//   - Whether all cluster workers agree on engine_semver, hash_algorithm_version,
//     protocol_framing_version, and auth_version.
//   - cluster.replay.drift_rate = replay_divergences / replay_verifications
//   - Per-worker version mismatch details.
//
// INVARIANT (INV-7): All errors return structured JSON body.
// INVARIANT (INV-6): No engine logic here — proxies via engine-client.
// INVARIANT: export const dynamic = 'force-dynamic' required (INV-7).
//
// RBAC: auditor+ required (cluster_drift_read permission).

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchClusterDrift } from '@/lib/engine-client';
import type { ClusterDriftResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  // RBAC: auditor role required for drift data.
  const role = req.headers.get('X-Requiem-Role') ?? 'viewer';
  const auditorRoles = ['auditor', 'operator', 'admin'];
  if (!auditorRoles.includes(role)) {
    return NextResponse.json(
      { ok: false, error: 'rbac_denied', required_role: 'auditor', actual_role: role },
      { status: 403 },
    );
  }

  try {
    const drift = await fetchClusterDrift(auth.tenant);
    return NextResponse.json(drift satisfies ClusterDriftResponse);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'cluster_drift_unavailable', detail: msg },
      { status: 502 },
    );
  }
}
