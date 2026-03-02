// ready-layer/src/app/api/budgets/route.ts
//
// Phase B: Budgets API — /api/budgets
// Set, show, and reset tenant budgets.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Budget {
  tenant_id: string;
  exec: { limit: number; used: number; remaining: number };
  cas_put: { limit: number; used: number; remaining: number };
}

interface BudgetResponse {
  ok: boolean;
  data?: Budget;
  error?: { code: string; message: string; retryable: boolean };
  trace_id: string;
}

// GET - Show budget
export async function GET(request: Request): Promise<NextResponse<BudgetResponse>> {
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get('tenant');

  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (!tenant) {
    return NextResponse.json(
      { ok: false, error: { code: 'missing_tenant', message: 'tenant required', retryable: false }, trace_id },
      { status: 400 }
    );
  }

  // TODO: Replace with actual CLI call
  const response: BudgetResponse = {
    ok: true,
    data: {
      tenant_id: tenant,
      exec: { limit: 1000, used: 0, remaining: 1000 },
      cas_put: { limit: 5000, used: 0, remaining: 5000 },
    },
    trace_id,
  };

  return NextResponse.json(response, { status: 200 });
}

// POST - Set or reset budget
export async function POST(request: Request): Promise<NextResponse<BudgetResponse>> {
  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const _body = await request.json();
    // Variables extracted but not used - placeholder for actual implementation
    const tenant = (_body as Record<string, unknown>).tenant as string || 'default_tenant';
    const exec_limit = (_body as Record<string, unknown>).exec_limit as number || 1000;
    const cas_put_limit = (_body as Record<string, unknown>).cas_put_limit as number || 5000;

    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: { code: 'missing_tenant', message: 'tenant required', retryable: false }, trace_id },
        { status: 400 }
      );
    }

    // TODO: Replace with actual CLI call
    const response: BudgetResponse = {
      ok: true,
      data: {
        tenant_id: tenant,
        exec: { limit: exec_limit || 1000, used: 0, remaining: exec_limit || 1000 },
        cas_put: { limit: cas_put_limit || 5000, used: 0, remaining: cas_put_limit || 5000 },
      },
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
