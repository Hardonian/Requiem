// ready-layer/src/app/api/policies/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { demoUnavailableResponse, withDemoHeaders } from '@/lib/demo-truth';
import { ProblemError } from '@/lib/problem-json';
import type {
  PolicyListItem,
  PolicyVersionsResponse,
  ApiResponse,
  PaginatedResponse,
} from '@/types/engine';

export const dynamic = 'force-dynamic';

const getQuerySchema = z.object({
  policy: z.string().optional(),
  versions: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const postSchema = z.object({
  action: z.enum(['add', 'eval', 'test']),
  rules: z.array(z.unknown()).optional(),
  policy_hash: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, getQuerySchema);
      const policyId = query.policy;
      const versions = query.versions === 'true';
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;

      if (policyId && versions) {
        const response: ApiResponse<PolicyVersionsResponse> = {
          v: 1,
          kind: 'policy.versions',
          data: {
            ok: true,
            policy_id: policyId,
            versions: [],
          },
          error: null,
        };
        return withDemoHeaders(NextResponse.json(response, { status: 200 }));
      }
      const policies: PolicyListItem[] = [];

      const response: ApiResponse<PaginatedResponse<PolicyListItem>> = {
        v: 1,
        kind: 'policies.list',
        data: {
          ok: true,
          data: policies,
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
      routeId: 'policies.list',
      cache: { ttlMs: 10_000, visibility: 'private', staleWhileRevalidateMs: 10_000 },
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = postSchema.parse(await request.json());

      if (body.action === 'add') {
        if (!body.rules) {
          throw new ProblemError(400, 'Missing Argument', 'rules array required', {
            code: 'missing_argument',
          });
        }

        return demoUnavailableResponse(
          ctx,
          'Policy creation is not runtime-backed in this deployment. Wire a real policy registry before accepting writes.',
        );
      }

      if (body.action === 'eval') {
        if (!body.policy_hash || !body.context) {
          throw new ProblemError(400, 'Missing Argument', 'policy_hash and context required', {
            code: 'missing_argument',
          });
        }

        return demoUnavailableResponse(
          ctx,
          'Policy evaluation is not runtime-backed in this deployment. Connect a real policy engine before trusting decisions.',
        );
      }
      return demoUnavailableResponse(
        ctx,
        'Policy test execution is not runtime-backed in this deployment. Connect a real policy engine before relying on pass/fail signals.',
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'policies.mutate',
      idempotency: { required: false },
    },
  );
}
