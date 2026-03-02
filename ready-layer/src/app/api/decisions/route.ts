// ready-layer/src/app/api/decisions/route.ts
//
// Phase B: Decisions API — /api/decisions
// View policy decision history.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Decision {
  id: string;
  policy_id: string;
  result: string;
  timestamp: number;
}

interface DecisionsResponse {
  ok: boolean;
  data?: Decision[];
  total?: number;
  error?: { code: string; message: string; retryable: boolean };
  trace_id: string;
}

export async function GET(_request: Request): Promise<NextResponse<DecisionsResponse>> {
  // const { searchParams } = new URL(_request.url);
  // const limit = parseInt(searchParams.get('limit') || '100', 10);
  // const offset = parseInt(searchParams.get('offset') || '0', 10);

  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // TODO: Replace with actual CLI call
  const response: DecisionsResponse = {
    ok: true,
    data: [],
    total: 0,
    trace_id,
  };

  return NextResponse.json(response, { status: 200 });
}
