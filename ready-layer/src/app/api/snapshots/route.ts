// ready-layer/src/app/api/snapshots/route.ts
//
// Phase B: Snapshots API — /api/snapshots
// Create, list, and restore system snapshots.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Snapshot {
  id: string;
  timestamp: number;
}

interface SnapshotResponse {
  ok: boolean;
  data?: Snapshot[];
  snapshot_id?: string;
  error?: { code: string; message: string; retryable: boolean };
  trace_id: string;
}

// GET - List snapshots
export async function GET(_request: Request): Promise<NextResponse<SnapshotResponse>> {
  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // TODO: Replace with actual CLI call
  const response: SnapshotResponse = {
    ok: true,
    data: [],
    trace_id,
  };

  return NextResponse.json(response, { status: 200 });
}

// POST - Create or restore snapshot
export async function POST(request: Request): Promise<NextResponse<SnapshotResponse>> {
  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await request.json();
    const { action, snapshot_id, force } = body;

    if (action === 'restore') {
      if (!snapshot_id) {
        return NextResponse.json(
          { ok: false, error: { code: 'missing_id', message: 'snapshot_id required', retryable: false }, trace_id },
          { status: 400 }
        );
      }

      if (!force) {
        return NextResponse.json(
          { ok: false, error: { code: 'force_required', message: '--force required for safety', retryable: false }, trace_id },
          { status: 400 }
        );
      }

      // TODO: Replace with actual CLI call - restore snapshot
      const response: SnapshotResponse = {
        ok: true,
        snapshot_id,
        trace_id,
      };
      return NextResponse.json(response, { status: 201 });
    }

    // Default: create snapshot
    // TODO: Replace with actual CLI call - create snapshot
    const response: SnapshotResponse = {
      ok: true,
      snapshot_id: `snap_${Date.now()}`,
      trace_id,
    };

    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'parse_error', message: 'Invalid JSON', retryable: false }, trace_id },
      { status: 400 }
    );
  }
}
