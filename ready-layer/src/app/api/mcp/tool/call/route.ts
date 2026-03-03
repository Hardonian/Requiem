import { NextResponse } from 'next/server';

function traceId(request: Request): string {
  return request.headers.get('x-trace-id') ?? crypto.randomUUID();
}

export async function POST(request: Request): Promise<Response> {
  const t = traceId(request);
  try {
    await import('@requiem/ai/bootstrap');
    const { POST_callTool } = await import('@requiem/ai/mcp');
    const response = await POST_callTool(request);
    response.headers.set('x-trace-id', t);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        type: 'https://httpstatuses.com/503',
        title: 'MCP Init Failed',
        status: 503,
        detail: 'MCP tool invocation unavailable: initialization failed',
        trace_id: t,
        ok: false,
        code: 'MCP_INIT_FAILED',
        message: 'MCP tool invocation unavailable: initialization failed',
        error: error instanceof Error ? error.message : 'Unknown initialization error',
      },
      {
        status: 503,
        headers: {
          'content-type': 'application/problem+json',
          'x-trace-id': t,
        },
      },
    );
  }
}
