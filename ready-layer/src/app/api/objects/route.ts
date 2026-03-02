// ready-layer/src/app/api/objects/route.ts
//
// Phase B: CAS Objects API — /api/objects
// List and manage content-addressable storage objects.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface CasObject {
  digest: string;
  size: number;
  encoding: string;
}

interface ObjectsResponse {
  ok: boolean;
  data: CasObject[];
  total: number;
  trace_id: string;
}

// GET - List objects
export async function GET(_request: Request): Promise<NextResponse<ObjectsResponse>> {
  // const { searchParams } = new URL(_request.url);
  // const _prefix = searchParams.get('prefix') || '';
  // const _limit = parseInt(searchParams.get('limit') || '100', 10);

  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // TODO: Replace with actual CLI call
  const response: ObjectsResponse = {
    ok: true,
    data: [],
    total: 0,
    trace_id,
  };

  return NextResponse.json(response, { status: 200 });
}

// HEAD - Check object existence
export async function HEAD(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');

  if (!hash) {
    return NextResponse.json(
      { ok: false, error: { code: 'missing_hash', message: 'hash required', retryable: false } },
      { status: 400 }
    );
  }

  // TODO: Replace with actual CLI call
  return NextResponse.json({ ok: true, exists: false }, { status: 200 });
}
