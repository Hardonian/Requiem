import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { fetchAutotuneState, postAutotuneTick } from '@/lib/engine-client';
import type { AutotuneState } from '@/types/engine';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  action: z.enum(['tick', 'revert']).default('tick'),
}).passthrough();

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      try {
        const state = await fetchAutotuneState({ tenant_id: ctx.tenant_id, auth_token: ctx.auth_token });
        return NextResponse.json(state satisfies AutotuneState, { status: 200 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Autotune Unavailable', msg, { code: 'autotune_unavailable' });
      }
    },
    async () => {
      const role = req.headers.get('x-requiem-role') ?? 'viewer';
      const allowed = ['operator', 'admin'];
      return {
        allow: allowed.includes(role),
        reasons: allowed.includes(role) ? [] : [`rbac_denied:${role}`],
      };
    },
    {
      routeId: 'engine.autotune.get',
      cache: { ttlMs: 3000, visibility: 'private', staleWhileRevalidateMs: 3000 },
    },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const body = await parseJsonWithSchema(req, postSchema);

      try {
        const result = await postAutotuneTick(
          { tenant_id: ctx.tenant_id, auth_token: ctx.auth_token },
          body.action,
        );
        return NextResponse.json(result, { status: 200 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Autotune Action Failed', msg, { code: 'autotune_action_failed' });
      }
    },
    async () => {
      const role = req.headers.get('x-requiem-role') ?? 'viewer';
      return {
        allow: role === 'admin',
        reasons: role === 'admin' ? [] : [`rbac_denied:${role}`],
      };
    },
    {
      routeId: 'engine.autotune.post',
      idempotency: { required: false },
    },
  );
}
