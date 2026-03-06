import { NextResponse } from 'next/server';
import { traceIdFromHeaders, unknownErrorToProblem } from '@/lib/problem-json';
import { getRuntimeManifest } from '@/lib/runtime-manifest';

export async function GET(request: Request): Promise<NextResponse> {
  const traceId = traceIdFromHeaders(request.headers);
  try {
    const manifest = getRuntimeManifest();
    const backend = await fetch(new URL('/api/health', request.url), { cache: 'no-store' })
      .then((res) => ({ reachable: res.ok, status: res.status }))
      .catch(() => ({ reachable: false, status: 0 }));

    return NextResponse.json(
      {
        ...manifest,
        backend,
        trace_id: traceId,
      },
      {
        status: 200,
        headers: {
          'x-trace-id': traceId,
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    return unknownErrorToProblem(error, traceId);
  }
}
