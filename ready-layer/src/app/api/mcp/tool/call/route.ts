// ready-layer/src/app/api/mcp/tool/call/route.ts
// Lazy initialization avoids build-time hard failures when runtime secrets are absent.

import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<Response> {
  try {
    await import('@requiem/ai/bootstrap');
    const { POST_callTool } = await import('@requiem/ai/mcp');
    return await POST_callTool(request);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: 'MCP_INIT_FAILED',
        message: 'MCP tool invocation unavailable: initialization failed',
        error: error instanceof Error ? error.message : 'Unknown initialization error',
      },
      { status: 503 }
    );
  }
}
