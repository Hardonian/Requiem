import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async () => {
      const missing = new URL(req.url).searchParams.get('missing');
      if (missing === '1') {
        throw new ProblemError(404, 'Not Found', 'Probe requested missing path', { code: 'not_found' });
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      requireAuth: false,
      routeId: 'routes.probe',
      rateLimit: false,
      cache: false,
    },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async () => {
      throw new ProblemError(405, 'Method Not Allowed', 'Use GET for routes probe', { code: 'method_not_allowed' });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      requireAuth: false,
      routeId: 'routes.probe',
      rateLimit: false,
      cache: false,
    },
  );
}
