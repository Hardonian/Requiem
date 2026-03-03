// ready-layer/src/app/api/objects/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
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
      const prefix = query.prefix || '';
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;

      const mockObjects: CasObject[] = [];
      for (let i = 0; i < Math.min(limit, 20); i++) {
        const digest = `${prefix}abcdef${i.toString(16).padStart(58, '0')}`.slice(0, 64);
        mockObjects.push({
          digest,
          encoding: i % 3 === 0 ? 'zstd' : 'identity',
          original_size: 1024 * (i + 1),
          stored_size: i % 3 === 0 ? 512 * (i + 1) : 1024 * (i + 1),
          created_at_unix_ms: Date.now() - (i * 3600000),
        });
      }

      const paginatedData: PaginatedResponse<CasObject> = {
        ok: true,
        data: mockObjects,
        total: 100,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        has_more: offset + mockObjects.length < 100,
        trace_id: ctx.trace_id,
      };

      const response: ApiResponse<PaginatedResponse<CasObject>> = {
        v: 1,
        kind: 'cas.objects.list',
        data: paginatedData,
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
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
    async () => {
      const query = parseQueryWithSchema(request, headQuerySchema);
      if (!query.hash) {
        throw new ProblemError(400, 'Missing Hash', 'hash required', {
          code: 'missing_hash',
        });
      }

      const response: ApiResponse<{ exists: boolean }> = {
        v: 1,
        kind: 'cas.object.head',
        data: { exists: true },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'objects.head',
      cache: { ttlMs: 5_000, visibility: 'private', staleWhileRevalidateMs: 5_000 },
    },
  );
}
