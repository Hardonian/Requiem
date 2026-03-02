// ready-layer/src/app/api/runs/route.ts
//
// Phase B: Runs API — /api/runs
// Plan run listing and retrieval.

import { NextResponse } from 'next/server';
import type { 
  PlanRunResult,
  TypedError, 
  ApiResponse,
  PaginatedResponse 
} from '@/types/engine';

export const dynamic = 'force-dynamic';

function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createError(code: string, message: string, retryable = false): TypedError {
  return { code, message, details: {}, retryable };
}

// GET - List runs
export async function GET(request: Request): Promise<NextResponse> {
  const trace_id = generateTraceId();
  
  try {
    const { searchParams } = new URL(request.url);
    const plan_hash = searchParams.get('plan-hash');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // TODO: Replace with actual CLI call
    const mockRuns: PlanRunResult[] = [];
    
    for (let i = 0; i < Math.min(limit, 20); i++) {
      mockRuns.push({
        run_id: `run_${Date.now()}_${offset + i}`,
        plan_hash: plan_hash || `plan_hash_${(i % 5).toString(16).padStart(60, '0')}`,
        steps_completed: 3,
        steps_total: 3,
        ok: i % 7 !== 0, // Every 7th run fails for variety
        step_results: {
          step_1: { ok: true, duration_ns: 1000000, result_digest: `res_${i}_1` },
          step_2: { ok: true, duration_ns: 1000000, result_digest: `res_${i}_2` },
          step_3: { ok: i % 7 !== 0, duration_ns: 1000000, result_digest: `res_${i}_3` },
        },
        receipt_hash: `receipt_${Date.now()}_${i}`,
        started_at_unix_ms: Date.now() - (i * 3600000),
        completed_at_unix_ms: Date.now() - (i * 3600000) + 5000,
      });
    }

    const response: ApiResponse<PaginatedResponse<PlanRunResult>> = {
      v: 1,
      kind: 'runs.list',
      data: {
        ok: true,
        data: mockRuns,
        total: 100,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        has_more: offset + mockRuns.length < 100,
        trace_id,
      },
      error: null,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('internal_error', error instanceof Error ? error.message : 'Unknown error', false),
    };
    return NextResponse.json(response, { status: 500 });
  }
}
