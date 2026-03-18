// ready-layer/src/app/api/caps/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { demoUnavailableResponse, withDemoHeaders } from '@/lib/demo-truth';
import { ProblemError } from '@/lib/problem-json';
import type {
  CapabilityListItem,
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
      const capabilities: CapabilityListItem[] = [];

      const response: ApiResponse<PaginatedResponse<CapabilityListItem>> = {
        v: 1,
        kind: 'caps.list',
        data: {
          ok: true,
          data: capabilities,
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
      routeId: 'caps.list',
      cache: { ttlMs: 10_000, visibility: 'private', staleWhileRevalidateMs: 10_000 },
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = postSchema.parse(await request.json());

      if (body.action === 'mint') {
        if (!body.subject || !body.permissions) {
          throw new ProblemError(400, 'Missing Argument', 'subject and permissions array required', {
            code: 'missing_argument',
          });
        }

        return demoUnavailableResponse(
          ctx,
          'Capability minting is not runtime-backed in this deployment. Wire a real capability service before issuing tokens.',
        );
      }

      if (!body.fingerprint) {
        throw new ProblemError(400, 'Missing Argument', 'fingerprint required', {
          code: 'missing_argument',
        });
      }

      return demoUnavailableResponse(
        ctx,
        'Capability revocation is not runtime-backed in this deployment. Connect a real capability registry before revoking tokens.',
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'caps.mutate',
      idempotency: { required: false },
    },
  );
}
