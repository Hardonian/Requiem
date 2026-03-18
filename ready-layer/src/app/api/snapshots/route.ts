// ready-layer/src/app/api/snapshots/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { demoUnavailableResponse, withDemoHeaders } from '@/lib/demo-truth';
import { ProblemError } from '@/lib/problem-json';
import type {
  Snapshot,
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
      const snapshots: Snapshot[] = [];

      const response: ApiResponse<PaginatedResponse<Snapshot>> = {
        v: 1,
        kind: 'snapshots.list',
        data: {
          ok: true,
          data: snapshots,
          total: 0,
          page: Math.floor(offset / limit) + 1,
          page_size: limit,
          has_more: false,
          trace_id: ctx.trace_id,
        },
        error: null,
      };

      return withDemoHeaders(NextResponse.json(response, { status: 200 }));
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
    async (ctx) => {
      const body = postSchema.parse(await request.json());

      if (body.action === 'create') {
        return demoUnavailableResponse(
          ctx,
          'Snapshot creation is not runtime-backed in this deployment. Connect a real snapshot service before creating rollback points.',
        );
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

      return demoUnavailableResponse(
        ctx,
        `Snapshot restore for ${body.snapshot_hash} is not runtime-backed in this deployment. Attach a real snapshot service before enabling rollback.`,
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'snapshots.mutate',
      idempotency: { required: false },
    },
  );
}
