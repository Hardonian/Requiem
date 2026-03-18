// ready-layer/src/app/api/plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { demoUnavailableResponse, withDemoHeaders } from '@/lib/demo-truth';
import { ProblemError } from '@/lib/problem-json';
import type {
  Plan,
  PlanListResponse,
  PlanShowResponse,
  ApiResponse,
} from '@/types/engine';

export const dynamic = 'force-dynamic';

const getQuerySchema = z.object({
  'plan-hash': z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const postSchema = z.object({
  action: z.enum(['add', 'run', 'replay']),
  plan_id: z.string().optional(),
  steps: z.array(z.unknown()).optional(),
  plan_hash: z.string().optional(),
  run_id: z.string().optional(),
  verify_exact: z.boolean().optional(),
}).passthrough();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async () => {
      const query = parseQueryWithSchema(request, getQuerySchema);
      const planHash = query['plan-hash'];

      if (planHash) {
        return withDemoHeaders(
          NextResponse.json(
            {
              v: 1,
              kind: 'plan.show',
              data: {
                ok: false,
                error: {
                  code: 'plan_not_found',
                  message: `No runtime-backed plan found for hash ${planHash}.`,
                  details: {},
                  retryable: false,
                },
              },
              error: null,
            } satisfies ApiResponse<PlanShowResponse>,
            { status: 404 },
          ),
        );
      }
      const plans: Plan[] = [];

      const response: ApiResponse<PlanListResponse> = {
        v: 1,
        kind: 'plans.list',
        data: {
          ok: true,
          plans,
          total: 0,
        },
        error: null,
      };

      return withDemoHeaders(NextResponse.json(response, { status: 200 }));
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'plans.list_or_show',
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
        if (!body.plan_id || !body.steps) {
          throw new ProblemError(400, 'Missing Argument', 'plan_id and steps array required', {
            code: 'missing_argument',
          });
        }

        return demoUnavailableResponse(
          ctx,
          'Plan creation is not runtime-backed in this deployment. Connect a real plan service before accepting workflow definitions.',
        );
      }

      if (body.action === 'run') {
        if (!body.plan_hash) {
          throw new ProblemError(400, 'Missing Argument', 'plan_hash required', {
            code: 'missing_argument',
          });
        }

        return demoUnavailableResponse(
          ctx,
          `Plan execution for ${body.plan_hash} is not runtime-backed in this deployment. Connect a real execution service before triggering runs.`,
        );
      }

      if (!body.run_id) {
        throw new ProblemError(400, 'Missing Argument', 'run_id required', {
          code: 'missing_argument',
        });
      }

      return demoUnavailableResponse(
        ctx,
        `Plan replay for ${body.run_id} is not runtime-backed in this deployment. Connect a real replay service before trusting replay results.`,
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'plans.mutate',
      idempotency: { required: false },
    },
  );
}
