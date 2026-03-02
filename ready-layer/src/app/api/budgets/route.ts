// ready-layer/src/app/api/budgets/route.ts
//
// Phase B: Budgets API — /api/budgets
// Budget management for tenant resource limits.

import { NextResponse } from 'next/server';
import type { BudgetSetRequest, BudgetSetResponse, BudgetShowResponse, BudgetResetResponse, TypedError, ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createError(code: string, message: string, retryable = false): TypedError {
  return { code, message, details: {}, retryable };
}

// GET - Show budget for a tenant
export async function GET(request: Request): Promise<NextResponse> {
  const traceId = generateTraceId(); // eslint-disable-line @typescript-eslint/no-unused-vars
  
  try {
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get('tenant') || 'default';

    // TODO: Replace with actual CLI call
    const mockBudget = {
      tenant_id,
      budgets: {
        exec: { limit: 1000, used: 42, remaining: 958 },
        cas_put: { limit: 5000, used: 150, remaining: 4850 },
        cas_get: { limit: 10000, used: 2300, remaining: 7700 },
        policy_eval: { limit: 5000, used: 89, remaining: 4911 },
        plan_step: { limit: 2000, used: 12, remaining: 1988 },
      },
      budget_hash: 'abc123def456',
      version: 1,
    };

    const response: ApiResponse<BudgetShowResponse> = {
      v: 1,
      kind: 'budget.show',
      data: { ok: true, budget: mockBudget },
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

// POST - Set budget or reset window
export async function POST(request: Request): Promise<NextResponse> {
  const traceId = generateTraceId(); // eslint-disable-line @typescript-eslint/no-unused-vars
  
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'set') {
      const { tenant_id, unit, limit }: BudgetSetRequest = body;
      
      if (!tenant_id || !unit || !limit) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'tenant_id, unit, and limit required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // TODO: Replace with actual CLI call
      const response: ApiResponse<BudgetSetResponse> = {
        v: 1,
        kind: 'budget.set',
        data: { ok: true },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    if (action === 'reset-window') {
      const { tenant_id } = body;
      
      if (!tenant_id) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'tenant_id required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // TODO: Replace with actual CLI call
      const response: ApiResponse<BudgetResetResponse> = {
        v: 1,
        kind: 'budget.reset_window',
        data: { ok: true, message: 'Budget window reset successfully' },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('invalid_action', 'Action must be "set" or "reset-window"', false),
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
