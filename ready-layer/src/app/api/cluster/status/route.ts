// ready-layer/src/app/api/cluster/status/route.ts
//
// GET /api/cluster/status — Distributed cluster platform status endpoint.
//
// Returns the current cluster coordination state including:
//   - cluster_mode flag
//   - total_workers and healthy_workers counts
//   - total_shards and local shard assignment
//   - local worker_id and node_id
//
// INVARIANT (INV-7): All errors return structured JSON body.
// INVARIANT (INV-6): No engine logic here — proxies via engine-client.
// INVARIANT: export const dynamic = 'force-dynamic' required (INV-7).

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchClusterStatus } from '@/lib/engine-client';
import type { ClusterStatusResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  try {
    const status = await fetchClusterStatus(auth.tenant);
    return NextResponse.json(status satisfies ClusterStatusResponse);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'cluster_status_unavailable', detail: msg },
      { status: 502 },
    );
  }
}
