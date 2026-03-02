// ready-layer/src/app/api/snapshots/route.ts
//
// Phase B: Snapshots API — /api/snapshots
// Snapshot management for state checkpoint/restore.

import { NextResponse } from 'next/server';
import type { 
  Snapshot,
  SnapshotCreateResponse,
  SnapshotRestoreResponse,
  TypedError, 
  ApiResponse,
  PaginatedResponse 
} from '@/types/engine';

export const dynamic = 'force-dynamic';

function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createError(code: string, message: string, retryable = false): TypedError {
  return { code, message, details: {}, retryable };
}

// GET - List snapshots
export async function GET(request: Request): Promise<NextResponse> {
  const traceId = generateTraceId(); // eslint-disable-line @typescript-eslint/no-unused-vars
  
  try {
    const { searchParams } = new URL(request.url);
    const _tenant = searchParams.get('tenant') || ''; // eslint-disable-line @typescript-eslint/no-unused-vars
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // TODO: Replace with actual CLI call
    const mockSnapshots: Snapshot[] = [];
    
    for (let i = 0; i < Math.min(limit, 10); i++) {
      mockSnapshots.push({
        snapshot_version: 1,
        logical_time: offset + i + 1,
        event_log_head: `evt_head_${offset + i + 1}`,
        cas_root_hash: `cas_root_${(offset + i + 1).toString(16).padStart(60, '0')}`,
        active_caps: [`cap_${i}_admin`, `cap_${i}_user`],
        revoked_caps: [],
        budgets: {},
        policies: {},
        snapshot_hash: `snap_${(offset + i + 1).toString(16).padStart(60, '0')}`,
        timestamp_unix_ms: Date.now() - (i * 86400000),
      });
    }

    const response: ApiResponse<PaginatedResponse<Snapshot>> = {
      v: 1,
      kind: 'snapshots.list',
      data: {
        ok: true,
        data: mockSnapshots,
        total: 50,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        has_more: offset + mockSnapshots.length < 50,
        trace_id: traceId,
      },
      error: null,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('internal_error', error instanceof Error ? error.message : 'Unknown error', false),
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// POST - Create or restore snapshot
export async function POST(request: Request): Promise<NextResponse> {
  const traceId = generateTraceId(); // eslint-disable-line @typescript-eslint/no-unused-vars
  
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { tenant_id } = body;

      // TODO: Replace with actual CLI call
      const snapshot: Snapshot = {
        snapshot_version: 1,
        logical_time: Date.now(),
        event_log_head: `evt_head_${Date.now()}`,
        cas_root_hash: `cas_root_${Date.now().toString(36)}`,
        active_caps: ['cap_admin', 'cap_user'],
        revoked_caps: [],
        budgets: {},
        policies: {},
        snapshot_hash: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp_unix_ms: Date.now(),
      };

      const response: ApiResponse<SnapshotCreateResponse> = {
        v: 1,
        kind: 'snapshot.create',
        data: { ok: true, snapshot },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    if (action === 'restore') {
      const { snapshot_hash, force } = body;
      
      if (!snapshot_hash) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'snapshot_hash required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      if (!force) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('operation_gated', 
            'Snapshot restore is gated. Use force=true to proceed. '
            + 'WARNING: This will revert state to the snapshot point.', false),
        };
        return NextResponse.json(response, { status: 403 });
      }

      // TODO: Replace with actual CLI call
      const response: ApiResponse<SnapshotRestoreResponse> = {
        v: 1,
        kind: 'snapshot.restore',
        data: {
          ok: true,
          restored_logical_time: Date.now() - 86400000,
          message: `Successfully restored from snapshot ${snapshot_hash}`,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('invalid_action', 'Action must be "create" or "restore"', false),
    };
    return NextResponse.json(response, { status: 400 });
  } catch (error) {
    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('internal_error', error instanceof Error ? error.message : 'Unknown error', false),
    };
    return NextResponse.json(response, { status: 500 });
  }
}
