// ready-layer/src/app/api/decisions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';

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

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const response: DecisionsResponse = {
        ok: true,
        data: [],
        total: 0,
        trace_id: ctx.trace_id,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'decisions.list',
      cache: { ttlMs: 10_000, visibility: 'private', staleWhileRevalidateMs: 10_000 },
    },
  );
}
