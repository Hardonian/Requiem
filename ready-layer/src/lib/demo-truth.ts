import { NextResponse } from 'next/server';
import type { RequestContext } from './big4-http';
import { problemResponse } from './problem-json';

export function withDemoHeaders<TResponse extends Response>(
  response: TResponse,
  truth: 'empty' | 'unavailable' = 'empty',
): TResponse {
  response.headers.set('x-requiem-mode', 'demo');
  response.headers.set('x-requiem-truth', truth);
  return response;
}

export function demoUnavailableResponse(
  ctx: Pick<RequestContext, 'trace_id' | 'request_id'>,
  detail: string,
  status = 503,
): NextResponse {
  return withDemoHeaders(
    problemResponse({
      status,
      title: 'Runtime Backend Unavailable',
      detail,
      code: 'runtime_backend_unavailable',
      traceId: ctx.trace_id,
      requestId: ctx.request_id,
    }),
    'unavailable',
  );
}
