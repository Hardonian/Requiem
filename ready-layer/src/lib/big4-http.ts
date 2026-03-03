import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

export interface RequestContext {
  tenant_id: string;
  actor_id: string;
  request_id: string;
  trace_id: string;
}

const bucket = new Map<string, { count: number; resetAt: number }>();

function problem(status: number, title: string, detail: string, traceId: string): Response {
  return new Response(JSON.stringify({
    type: `https://httpstatuses.com/${status}`,
    title,
    status,
    detail,
    trace_id: traceId,
  }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

function extractContext(headers: Headers): RequestContext {
  return {
    tenant_id: headers.get('x-tenant-id') ?? 'public',
    actor_id: headers.get('x-actor-id') ?? 'anonymous',
    request_id: headers.get('x-request-id') ?? randomUUID(),
    trace_id: headers.get('x-trace-id') ?? randomUUID(),
  };
}

function checkRateLimit(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const state = bucket.get(key);
  if (!state || state.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (state.count >= limit) return false;
  state.count += 1;
  return true;
}

export async function withTenantContext(
  req: NextRequest,
  handler: (ctx: RequestContext) => Promise<Response>,
  policyEval: (ctx: RequestContext) => Promise<{ allow: boolean; reasons: string[] }> = async () => ({ allow: true, reasons: [] }),
): Promise<Response> {
  const ctx = extractContext(req.headers);
  if (!checkRateLimit(`${ctx.tenant_id}:${req.nextUrl.pathname}`)) {
    return problem(429, 'Too Many Requests', 'Rate limit exceeded', ctx.trace_id);
  }

  const policy = await policyEval(ctx);
  if (!policy.allow) {
    return problem(403, 'Policy Denied', policy.reasons.join('; ') || 'Denied', ctx.trace_id);
  }

  try {
    const response = await handler(ctx);
    response.headers.set('x-trace-id', ctx.trace_id);
    response.headers.set('x-request-id', ctx.request_id);
    return response;
  } catch {
    return problem(500, 'Internal Error', 'Request failed safely', ctx.trace_id);
  }
}
