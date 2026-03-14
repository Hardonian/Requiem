import { NextResponse } from 'next/server';

function traceId(request: Request): string {
  return request.headers.get('x-trace-id') ?? crypto.randomUUID();
}

function mcpInitFailureResponse(request: Request, error: unknown, detail: string): Response {
  const t = traceId(request);
  console.error('mcp.init.failure', {
    trace_id: t,
    route: new URL(request.url).pathname,
    error: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    {
      type: 'https://httpstatuses.com/503',
      title: 'MCP Init Failed',
      status: 503,
      detail,
      trace_id: t,
      ok: false,
      code: 'MCP_INIT_FAILED',
      message: detail,
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

export async function GET(request: Request): Promise<Response> {
  const t = traceId(request);
  try {
    await import('@requiem/ai/bootstrap');
    const { GET_tools } = await import('@requiem/ai/mcp');
    const response = await GET_tools(request);
    response.headers.set('x-trace-id', t);
    return response;
  } catch (error) {
    return mcpInitFailureResponse(request, error, 'MCP tools unavailable: initialization failed');
  }
}
