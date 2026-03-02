// ready-layer/src/app/api/plans/route.ts
//
// Phase B: Plans API — /api/plans
// Plan DAG management and execution.

import { NextResponse } from 'next/server';
import type { 
  Plan,
  PlanStep,
  PlanRunResult,
  PlanAddResponse,
  PlanListResponse,
  PlanShowResponse,
  PlanReplayResponse,
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

// GET - List plans or show a specific plan
export async function GET(request: Request): Promise<NextResponse> {
  const trace_id = generateTraceId();
  
  try {
    const { searchParams } = new URL(request.url);
    const plan_hash = searchParams.get('plan-hash');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // If plan hash provided, show specific plan
    if (plan_hash) {
      const mockPlan: Plan = {
        plan_id: 'plan_001',
        plan_version: 1,
        plan_hash,
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
          plan_hash,
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

    // Otherwise list plans
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

// POST - Add plan, run plan, or replay plan
export async function POST(request: Request): Promise<NextResponse> {
  const trace_id = generateTraceId();
  
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'add') {
      const { plan_id, steps } = body;
      
      if (!plan_id || !steps || !Array.isArray(steps)) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'plan_id and steps array required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // TODO: Replace with actual CLI call
      const plan_hash = `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      
      const response: ApiResponse<PlanAddResponse> = {
        v: 1,
        kind: 'plan.add',
        data: {
          ok: true,
          plan: {
            plan_id,
            plan_version: 1,
            plan_hash,
            steps,
          },
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    if (action === 'run') {
      const { plan_hash, workspace, seq, nonce } = body;
      
      if (!plan_hash) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'plan_hash required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // TODO: Replace with actual CLI call
      const runResult: PlanRunResult = {
        run_id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        plan_hash,
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

    if (action === 'replay') {
      const { run_id, verify_exact } = body;
      
      if (!run_id) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'run_id required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // TODO: Replace with actual CLI call
      const replayResult: PlanReplayResponse = {
        ok: true,
        original_run_id: run_id,
        replay_run_id: `replay_${Date.now()}`,
        exact_match: verify_exact !== false,
        receipt_hash_original: `receipt_orig_${Date.now()}`,
        receipt_hash_replay: verify_exact !== false ? `receipt_orig_${Date.now()}` : `receipt_replay_${Date.now()}`,
      };

      const response: ApiResponse<PlanReplayResponse> = {
        v: 1,
        kind: 'plan.replay',
        data: replayResult,
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('invalid_action', 'Action must be "add", "run", or "replay"', false),
    };
    return NextResponse.json(response, { status: 400 });
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
