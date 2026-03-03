// ready-layer/src/app/api/mcp/health/route.ts
// Lazy initialization avoids build-time hard failures when runtime secrets are absent.

import { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<Response> {
  try {
    await import('@requiem/ai/bootstrap');
    const { GET_health } = await import('@requiem/ai/mcp');
    return await GET_health(request);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: 'degraded',
        code: 'MCP_INIT_FAILED',
        message: 'MCP service unavailable: initialization failed',
        error: error instanceof Error ? error.message : 'Unknown initialization error',
      },
      { status: 503 }
    );
  }
}
