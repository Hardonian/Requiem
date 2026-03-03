// ready-layer/src/app/api/caps/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import type {
  CapabilityMintResponse,
  CapabilityListItem,
  CapabilityRevokeResponse,
  ApiResponse,
  PaginatedResponse,
} from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const postSchema = z.object({
  action: z.enum(['mint', 'revoke']),
  subject: z.string().min(1).optional(),
  permissions: z.array(z.string().min(1)).optional(),
  not_before: z.number().int().optional(),
  not_after: z.number().int().optional(),
  fingerprint: z.string().min(1).optional(),
}).passthrough();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;

      const mockCaps: CapabilityListItem[] = [];
      for (let i = 0; i < Math.min(limit, 10); i++) {
        mockCaps.push({
          actor: ctx.tenant_id,
          seq: offset + i + 1,
          data_hash: `cap_hash_${offset + i}`,
          event_type: 'cap.mint',
        });
      }

      const response: ApiResponse<PaginatedResponse<CapabilityListItem>> = {
        v: 1,
        kind: 'caps.list',
        data: {
          ok: true,
          data: mockCaps,
          total: 100,
          page: Math.floor(offset / limit) + 1,
          page_size: limit,
          has_more: offset + mockCaps.length < 100,
          trace_id: ctx.trace_id,
        },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'caps.list',
      cache: { ttlMs: 10_000, visibility: 'private', staleWhileRevalidateMs: 10_000 },
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async () => {
      const body = postSchema.parse(await request.json());

      if (body.action === 'mint') {
        if (!body.subject || !body.permissions) {
          throw new ProblemError(400, 'Missing Argument', 'subject and permissions array required', {
            code: 'missing_argument',
          });
        }

        const response: ApiResponse<CapabilityMintResponse> = {
          v: 1,
          kind: 'caps.mint',
          data: {
            ok: true,
            fingerprint: `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            subject: body.subject,
            scopes: body.permissions,
            not_before: body.not_before || 0,
            not_after: body.not_after || 0,
          },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (!body.fingerprint) {
        throw new ProblemError(400, 'Missing Argument', 'fingerprint required', {
          code: 'missing_argument',
        });
      }

      const response: ApiResponse<CapabilityRevokeResponse> = {
        v: 1,
        kind: 'caps.revoke',
        data: { ok: true, fingerprint: body.fingerprint, revoked: true },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'caps.mutate',
      idempotency: { required: false },
    },
  );
}
