import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { computeReadiness } from '@/lib/readiness';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async () => {
      const readiness = await computeReadiness();
      return NextResponse.json(readiness, {
        status: readiness.ok ? 200 : 503,
      });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      requireAuth: false,
      routeId: 'readiness',
      rateLimit: false,
      cache: false,
    },
  );
}
