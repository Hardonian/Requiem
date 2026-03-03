// ready-layer/src/app/api/policies/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import type {
  PolicyDecision,
  PolicyAddResponse,
  PolicyListItem,
  PolicyEvalResponse,
  PolicyVersionsResponse,
  PolicyTestResponse,
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
            versions: ['v1', 'v2', 'v3'],
          },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      const mockPolicies: PolicyListItem[] = [];
      for (let i = 0; i < Math.min(limit, 15); i++) {
        mockPolicies.push({
          hash: `policy_${(offset + i).toString(16).padStart(62, '0')}`,
          size: 1024 + (i * 100),
          created_at_unix_ms: Date.now() - (i * 86400000),
        });
      }

      const response: ApiResponse<PaginatedResponse<PolicyListItem>> = {
        v: 1,
        kind: 'policies.list',
        data: {
          ok: true,
          data: mockPolicies,
          total: 50,
          page: Math.floor(offset / limit) + 1,
          page_size: limit,
          has_more: offset + mockPolicies.length < 50,
          trace_id: ctx.trace_id,
        },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
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
    async () => {
      const body = postSchema.parse(await request.json());

      if (body.action === 'add') {
        if (!body.rules) {
          throw new ProblemError(400, 'Missing Argument', 'rules array required', {
            code: 'missing_argument',
          });
        }

        const response: ApiResponse<PolicyAddResponse> = {
          v: 1,
          kind: 'policy.add',
          data: {
            ok: true,
            policy_hash: `pol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            size: JSON.stringify(body.rules).length,
          },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === 'eval') {
        if (!body.policy_hash || !body.context) {
          throw new ProblemError(400, 'Missing Argument', 'policy_hash and context required', {
            code: 'missing_argument',
          });
        }

        const decision: PolicyDecision = {
          decision: 'allow',
          matched_rule_id: 'R001',
          context_hash: `ctx_${Date.now().toString(36)}`,
          rules_hash: body.policy_hash,
          proof_hash: `proof_${Date.now().toString(36)}`,
          evaluated_at_logical_time: Date.now(),
        };

        const response: ApiResponse<PolicyEvalResponse> = {
          v: 1,
          kind: 'policy.eval',
          data: { ok: true, decision },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      const response: ApiResponse<PolicyTestResponse> = {
        v: 1,
        kind: 'policy.test',
        data: {
          ok: true,
          tests_run: 10,
          tests_passed: 10,
          tests_failed: 0,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'policies.mutate',
      idempotency: { required: false },
    },
  );
}
