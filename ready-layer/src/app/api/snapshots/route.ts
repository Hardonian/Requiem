// ready-layer/src/app/api/snapshots/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import type {
  Snapshot,
  SnapshotCreateResponse,
  SnapshotRestoreResponse,
  ApiResponse,
  PaginatedResponse,
} from '@/types/engine';

export const dynamic = 'force-dynamic';

const getQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const postSchema = z.object({
  action: z.enum(['create', 'restore']),
  snapshot_hash: z.string().optional(),
  force: z.boolean().optional(),
}).passthrough();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, getQuerySchema);
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;

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
          trace_id: ctx.trace_id,
        },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'snapshots.list',
      cache: { ttlMs: 10_000, visibility: 'private', staleWhileRevalidateMs: 10_000 },
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async () => {
      const body = postSchema.parse(await request.json());

      if (body.action === 'create') {
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

      if (!body.snapshot_hash) {
        throw new ProblemError(400, 'Missing Argument', 'snapshot_hash required', {
          code: 'missing_argument',
        });
      }

      if (!body.force) {
        throw new ProblemError(
          403,
          'Operation Gated',
          'Snapshot restore is gated. Use force=true to proceed.',
          { code: 'operation_gated' },
        );
      }

      const response: ApiResponse<SnapshotRestoreResponse> = {
        v: 1,
        kind: 'snapshot.restore',
        data: {
          ok: true,
          restored_logical_time: Date.now() - 86400000,
          message: `Successfully restored from snapshot ${body.snapshot_hash}`,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'snapshots.mutate',
      idempotency: { required: false },
    },
  );
}
