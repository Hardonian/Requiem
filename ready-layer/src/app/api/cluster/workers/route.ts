// ready-layer/src/app/api/cluster/workers/route.ts
//
// GET /api/cluster/workers — Distributed cluster worker registry endpoint.
//
// Returns the list of all registered workers in the cluster including
// per-worker health, shard assignment, and execution counters.
//
// INVARIANT (INV-7): All errors return structured JSON body.
// INVARIANT (INV-6): No engine logic here — proxies via engine-client.
// INVARIANT: export const dynamic = 'force-dynamic' required (INV-7).

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import { fetchClusterWorkers } from '@/lib/engine-client';
import type { ClusterWorkersResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await validateTenantAuth(req);
  if (!auth.ok || !auth.tenant) return authErrorResponse(auth);

  try {
    const workers = await fetchClusterWorkers(auth.tenant);
    return NextResponse.json(workers satisfies ClusterWorkersResponse);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: 'cluster_workers_unavailable', detail: msg },
      { status: 502 },
    );
  }
}
