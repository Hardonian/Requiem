import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { verifyReplay } from '@/lib/engine-client';
import type { ReplayVerifyResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  execution_id: z.string().min(1),
});

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const query = parseQueryWithSchema(req, querySchema);

      try {
        const result = await verifyReplay(
          { tenant_id: ctx.tenant_id, auth_token: ctx.auth_token },
          query.execution_id,
        );
        const status = result.verified ? 200 : 409;
        return NextResponse.json(result satisfies ReplayVerifyResponse, { status });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Replay Verify Failed', msg, { code: 'replay_verify_failed' });
      }
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'replay.verify',
    },
  );
}
