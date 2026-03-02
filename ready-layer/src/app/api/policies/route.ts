// ready-layer/src/app/api/policies/route.ts
//
// Phase B: Policies API — /api/policies
// Add, list, evaluate, and test policies.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Policy {
  id: string;
  hash: string;
}

interface PolicyResponse {
  ok: boolean;
  data?: Policy[];
  error?: { code: string; message: string; retryable: boolean };
  trace_id: string;
}

// GET - List policies
export async function GET(_request: Request): Promise<NextResponse<PolicyResponse>> {
  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // TODO: Replace with actual CLI call
  const response: PolicyResponse = {
    ok: true,
    data: [],
    trace_id,
  };

  return NextResponse.json(response, { status: 200 });
}

// POST - Add policy
export async function POST(_request: Request): Promise<NextResponse<PolicyResponse>> {
  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // const body = await _request.json();

    // TODO: Replace with actual CLI call - add policy
    const response: PolicyResponse = {
      ok: true,
      data: [{ id: 'policy_001', hash: 'abc123...' }],
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
