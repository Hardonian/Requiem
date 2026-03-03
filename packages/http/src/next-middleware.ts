import type { NextRequest } from 'next/server';
import { checkRateLimit } from './rate-limit.js';
import { extractContext } from './context.js';
import { problem } from './problem.js';

export async function withTenantContext(
  req: NextRequest,
  handler: (ctx: ReturnType<typeof extractContext>) => Promise<Response>,
  policyEval: (ctx: ReturnType<typeof extractContext>) => Promise<{ allow: boolean; reasons: string[] }> = async () => ({ allow: true, reasons: [] }),
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
