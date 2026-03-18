// ready-layer/src/app/api/objects/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { demoUnavailableResponse, withDemoHeaders } from '@/lib/demo-truth';
import { ProblemError } from '@/lib/problem-json';
import type { CasObject, PaginatedResponse, ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  prefix: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const headQuerySchema = z.object({
  hash: z.string().min(1),
});

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, listQuerySchema);
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;
      const objects: CasObject[] = [];

      const paginatedData: PaginatedResponse<CasObject> = {
        ok: true,
        data: objects,
        total: 0,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        has_more: false,
        trace_id: ctx.trace_id,
      };

      const response: ApiResponse<PaginatedResponse<CasObject>> = {
        v: 1,
        kind: 'cas.objects.list',
        data: paginatedData,
        error: null,
      };

      return withDemoHeaders(NextResponse.json(response, { status: 200 }));
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'objects.list',
      cache: { ttlMs: 10_000, visibility: 'private', staleWhileRevalidateMs: 10_000 },
    },
  );
}

export async function HEAD(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, headQuerySchema);
      if (!query.hash) {
        throw new ProblemError(400, 'Missing Hash', 'hash required', {
          code: 'missing_hash',
        });
      }
      return demoUnavailableResponse(
        ctx,
        'CAS object existence checks are not runtime-backed in this deployment. Attach a real CAS index before relying on HEAD checks.',
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'objects.head',
      cache: { ttlMs: 5_000, visibility: 'private', staleWhileRevalidateMs: 5_000 },
    },
  );
}
