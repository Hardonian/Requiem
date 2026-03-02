// ready-layer/src/app/api/plans/route.ts
//
// Phase B: Plans API — /api/plans
// Add, list, and run execution plans.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Plan {
  id: string;
  hash: string;
  created_at: number;
}

interface PlanResponse {
  ok: boolean;
  data?: Plan[];
  plan_id?: string;
  error?: { code: string; message: string; retryable: boolean };
  trace_id: string;
}

// GET - List plans
export async function GET(_request: Request): Promise<NextResponse<PlanResponse>> {
  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // TODO: Replace with actual CLI call
  const response: PlanResponse = {
    ok: true,
    data: [],
    trace_id,
  };

  return NextResponse.json(response, { status: 200 });
}

// POST - Add or run plan
export async function POST(request: Request): Promise<NextResponse<PlanResponse>> {
  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await request.json();
    const { action, plan_id } = body;

    if (action === 'run') {
      // TODO: Replace with actual CLI call - run plan
      const response: PlanResponse = {
        ok: true,
        plan_id: plan_id || 'run_001',
        trace_id,
      };
      return NextResponse.json(response, { status: 201 });
    }

    // Default: add plan
    // TODO: Replace with actual CLI call - add plan
    const response: PlanResponse = {
      ok: true,
      plan_id: 'plan_001',
      trace_id,
    };

    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'parse_error', message: 'Invalid JSON', retryable: false }, trace_id },
      { status: 400 }
    );
  }
}
