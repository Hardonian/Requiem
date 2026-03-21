import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonWithSchema, parseQueryWithSchema, withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import {
  enqueuePlanJob,
  listPlanJobs,
  processPlanJobs,
  recoverStalePlanJobs,
} from '@/lib/control-plane-store';
import type { ApiResponse, TenantJobMutationResponse, TenantJobsResponse } from '@/types/engine';

const JOB_EXECUTION_CLASS = {
  durability_class: 'durable-queued' as const,
  survives_process_loss: true,
  autonomous_worker: false,
  recovery_mechanism: 'Stale leases are recovered via action=recover or automatically during action=process. There is no autonomous background worker — processing requires explicit operator-driven calls.',
};

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  org_id: z.string().optional(),
});

const postSchema = z.object({
  action: z.enum(['enqueue', 'process', 'recover']),
  org_id: z.string().optional(),
  plan_hash: z.string().optional(),
  max_attempts: z.number().int().min(1).max(20).optional(),
  worker_id: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).strict();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const jobs = await listPlanJobs(ctx.tenant_id, ctx.actor_id, query.org_id);
      const response: ApiResponse<TenantJobsResponse & { execution_class: typeof JOB_EXECUTION_CLASS }> = {
        v: 1,
        kind: 'tenant.jobs.list',
        data: { ok: true, jobs, total: jobs.length, execution_class: JOB_EXECUTION_CLASS },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenant.jobs.list', cache: false },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, postSchema);

      if (body.action === 'enqueue') {
        if (!body.org_id || !body.plan_hash) {
          throw new ProblemError(400, 'Missing Argument', 'org_id and plan_hash are required when action=enqueue.', { code: 'missing_argument' });
        }
        const job = await enqueuePlanJob(ctx.tenant_id, ctx.actor_id, {
          org_id: body.org_id,
          plan_hash: body.plan_hash,
          max_attempts: body.max_attempts,
        });
        const response: ApiResponse<TenantJobMutationResponse & { execution_class: typeof JOB_EXECUTION_CLASS }> = {
          v: 1,
          kind: 'tenant.jobs.enqueue',
          data: { ok: true, job, execution_class: JOB_EXECUTION_CLASS },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === 'recover') {
        const recovered = await recoverStalePlanJobs(ctx.tenant_id, ctx.actor_id, body.org_id);
        const response: ApiResponse<TenantJobMutationResponse> = {
          v: 1,
          kind: 'tenant.jobs.recover',
          data: { ok: true, recovered_jobs: recovered },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      const workerId = body.worker_id ?? `worker-${ctx.actor_id}`;
      const processed = await processPlanJobs(ctx.tenant_id, ctx.actor_id, workerId, {
        org_id: body.org_id,
        limit: body.limit ?? 1,
      });
      const response: ApiResponse<TenantJobMutationResponse> = {
        v: 1,
        kind: 'tenant.jobs.process',
        data: {
          ok: true,
          jobs: processed.map((entry) => entry.job),
          run_id: processed[0]?.run_id ?? null,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenant.jobs.mutate', idempotency: { required: true } },
  );
}
