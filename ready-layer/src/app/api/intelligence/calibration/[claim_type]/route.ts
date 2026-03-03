import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { getCalibration } from '@/lib/intelligence-store';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ claim_type: string }> },
): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const window = req.nextUrl.searchParams.get('window') ?? undefined;
      if (window && !/^(\d+)([dh])$/i.test(window)) {
        throw new ProblemError(
          400,
          'Invalid Calibration Window',
          'window must match <number><d|h> (example: 30d or 72h)',
          { code: 'invalid_window' },
        );
      }
      const claimType = (await params).claim_type.toUpperCase();
      const data = getCalibration(ctx.tenant_id, claimType, window);

      return NextResponse.json(
        {
          ok: true,
          v: 1,
          tenant_id: ctx.tenant_id,
          claim_type: claimType,
          window: window ?? null,
          data,
          trace_id: ctx.trace_id,
        },
        { status: 200 },
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'intelligence.calibration.claim',
      cache: { ttlMs: 30_000, visibility: 'private', staleWhileRevalidateMs: 30_000 },
    },
  );
}
