// ready-layer/src/app/api/plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import type {
  Plan,
  PlanStep,
  PlanRunResult,
  PlanAddResponse,
  PlanListResponse,
  PlanShowResponse,
  PlanReplayResponse,
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
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;

      if (planHash) {
        const mockPlan: Plan = {
          plan_id: 'plan_001',
          plan_version: 1,
          plan_hash: planHash,
          steps: [
            {
              step_id: 'step_1',
              kind: 'exec',
              depends_on: [],
              config: {
                command: '/bin/sh',
                argv: ['-c', 'echo hello'],
                workspace_root: '.',
                timeout_ms: 5000,
              },
            },
            {
              step_id: 'step_2',
              kind: 'exec',
              depends_on: ['step_1'],
              config: {
                command: '/bin/sh',
                argv: ['-c', 'echo world'],
                workspace_root: '.',
                timeout_ms: 5000,
              },
            },
          ],
        };

        const mockRuns: PlanRunResult[] = [
          {
            run_id: `run_${Date.now()}_1`,
            plan_hash: planHash,
            steps_completed: 2,
            steps_total: 2,
            ok: true,
            step_results: {
              step_1: { ok: true, duration_ns: 1000000, result_digest: 'res_1' },
              step_2: { ok: true, duration_ns: 1000000, result_digest: 'res_2' },
            },
            receipt_hash: 'receipt_1',
            started_at_unix_ms: Date.now() - 3600000,
            completed_at_unix_ms: Date.now() - 3599000,
          },
        ];

        const response: ApiResponse<PlanShowResponse> = {
          v: 1,
          kind: 'plan.show',
          data: { ok: true, plan: mockPlan, runs: mockRuns },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      const mockPlans: Plan[] = [];
      for (let i = 0; i < Math.min(limit, 10); i++) {
        mockPlans.push({
          plan_id: `plan_${(offset + i).toString().padStart(3, '0')}`,
          plan_version: 1,
          plan_hash: `hash_${(offset + i).toString(16).padStart(60, '0')}`,
          steps: [],
        });
      }

      const response: ApiResponse<PlanListResponse> = {
        v: 1,
        kind: 'plans.list',
        data: {
          ok: true,
          plans: mockPlans,
          total: 30,
        },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
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
    async () => {
      const body = postSchema.parse(await request.json());

      if (body.action === 'add') {
        if (!body.plan_id || !body.steps) {
          throw new ProblemError(400, 'Missing Argument', 'plan_id and steps array required', {
            code: 'missing_argument',
          });
        }

        const plan_hash = `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

        const response: ApiResponse<PlanAddResponse> = {
          v: 1,
          kind: 'plan.add',
          data: {
            ok: true,
            plan: {
              plan_id: body.plan_id,
              plan_version: 1,
              plan_hash,
              steps: body.steps as PlanStep[],
            },
          },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === 'run') {
        if (!body.plan_hash) {
          throw new ProblemError(400, 'Missing Argument', 'plan_hash required', {
            code: 'missing_argument',
          });
        }

        const runResult: PlanRunResult = {
          run_id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          plan_hash: body.plan_hash,
          steps_completed: 3,
          steps_total: 3,
          ok: true,
          step_results: {
            step_1: { ok: true, duration_ns: 1000000, result_digest: 'res_1' },
            step_2: { ok: true, duration_ns: 1000000, result_digest: 'res_2' },
            step_3: { ok: true, duration_ns: 1000000, result_digest: 'res_3' },
          },
          receipt_hash: `receipt_${Date.now()}`,
          started_at_unix_ms: Date.now() - 1000,
          completed_at_unix_ms: Date.now(),
        };

        const response: ApiResponse<{ ok: boolean; result: PlanRunResult }> = {
          v: 1,
          kind: 'plan.run',
          data: { ok: true, result: runResult },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (!body.run_id) {
        throw new ProblemError(400, 'Missing Argument', 'run_id required', {
          code: 'missing_argument',
        });
      }

      const replayResult: PlanReplayResponse = {
        ok: true,
        original_run_id: body.run_id,
        replay_run_id: `replay_${Date.now()}`,
        exact_match: body.verify_exact !== false,
        receipt_hash_original: `receipt_orig_${Date.now()}`,
        receipt_hash_replay:
          body.verify_exact !== false
            ? `receipt_orig_${Date.now()}`
            : `receipt_replay_${Date.now()}`,
      };

      const response: ApiResponse<PlanReplayResponse> = {
        v: 1,
        kind: 'plan.replay',
        data: replayResult,
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'plans.mutate',
      idempotency: { required: false },
    },
  );
}
