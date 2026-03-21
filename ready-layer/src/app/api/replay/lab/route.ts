import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { listRunSummaries, getRunSummary } from '@/lib/control-plane-store';
import type { ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  run_id: z.string().optional(),
  compare_to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

interface ReplayLabResponse {
  ok: boolean;
  source: 'control-plane';
  runs: Array<{
    run_id: string;
    tenant_id: string;
    status: string;
    created_at: string;
    determinism_verified: boolean;
  }>;
  run_detail: {
    run_id: string;
    plan_hash: string;
    receipt_hash: string;
    result_digest: string;
  } | null;
  diff: {
    run_a: string;
    run_b: string;
    match: boolean;
    reason: string;
  } | null;
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const runs = await listRunSummaries(ctx.tenant_id);
      const limited = runs.slice(0, query.limit ?? 20);

      let runDetail = null;
      if (query.run_id) {
        runDetail = await getRunSummary(ctx.tenant_id, query.run_id);
      }

      let diff = null;
      if (query.run_id && query.compare_to) {
        const runA = await getRunSummary(ctx.tenant_id, query.run_id);
        const runB = await getRunSummary(ctx.tenant_id, query.compare_to);
        if (runA && runB) {
          const match = runA.result_digest === runB.result_digest;
          diff = {
            run_a: query.run_id,
            run_b: query.compare_to,
            match,
            reason: match ? 'result digests are identical' : 'result digests differ',
          };
        }
      }

      const result: ReplayLabResponse = {
        ok: true,
        source: 'control-plane',
        runs: limited,
        run_detail: runDetail,
        diff,
      };

      const response: ApiResponse<ReplayLabResponse> = {
        v: 1,
        kind: 'replay.lab',
        data: result,
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'replay.lab' },
  );
}
