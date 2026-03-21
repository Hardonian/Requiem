import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonWithSchema, parseQueryWithSchema, withTenantContext } from '@/lib/big4-http';
import {
  createInvite,
  acceptInvite,
  revokeInvite,
  listInvites,
} from '@/lib/control-plane-store';
import type { ApiResponse, TenantInviteResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  org_id: z.string().min(1),
});

const postSchema = z.object({
  action: z.enum(['create', 'accept', 'revoke']),
  org_id: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  token: z.string().min(1).optional(),
  invite_id: z.string().min(1).optional(),
}).strict();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const invites = await listInvites(ctx.tenant_id, ctx.actor_id, query.org_id);
      const response: ApiResponse<TenantInviteResponse> = {
        v: 1,
        kind: 'tenant.invites.list',
        data: { ok: true, invites },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenant.invites.list', cache: false },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, postSchema);

      if (body.action === 'create') {
        if (!body.org_id || !body.email || !body.role) {
          return NextResponse.json(
            { v: 1, kind: 'tenant.invites.create', data: null, error: { code: 'missing_argument', message: 'org_id, email, and role are required when action=create.', details: {}, retryable: false } },
            { status: 400 },
          );
        }
        const { invite, token } = await createInvite(ctx.tenant_id, ctx.actor_id, {
          org_id: body.org_id,
          email: body.email,
          role: body.role,
        });
        const response: ApiResponse<TenantInviteResponse & { token: string }> = {
          v: 1,
          kind: 'tenant.invites.create',
          data: { ok: true, invite, token },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === 'accept') {
        if (!body.token) {
          return NextResponse.json(
            { v: 1, kind: 'tenant.invites.accept', data: null, error: { code: 'missing_argument', message: 'token is required when action=accept.', details: {}, retryable: false } },
            { status: 400 },
          );
        }
        const result = await acceptInvite(ctx.tenant_id, ctx.actor_id, body.token);
        const response: ApiResponse<TenantInviteResponse & { membership: typeof result.membership }> = {
          v: 1,
          kind: 'tenant.invites.accept',
          data: { ok: true, invite: result.invite, membership: result.membership },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === 'revoke') {
        if (!body.invite_id) {
          return NextResponse.json(
            { v: 1, kind: 'tenant.invites.revoke', data: null, error: { code: 'missing_argument', message: 'invite_id is required when action=revoke.', details: {}, retryable: false } },
            { status: 400 },
          );
        }
        const invite = await revokeInvite(ctx.tenant_id, ctx.actor_id, body.invite_id);
        const response: ApiResponse<TenantInviteResponse> = {
          v: 1,
          kind: 'tenant.invites.revoke',
          data: { ok: true, invite },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      return NextResponse.json(
        { v: 1, kind: 'error', data: null, error: { code: 'invalid_action', message: 'Unknown action.', details: {}, retryable: false } },
        { status: 400 },
      );
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenant.invites.mutate', idempotency: { required: true } },
  );
}
