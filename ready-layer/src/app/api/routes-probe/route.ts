import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(req, async () => {
    const missing = new URL(req.url).searchParams.get('missing');
    if (missing === '1') {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  });
}
