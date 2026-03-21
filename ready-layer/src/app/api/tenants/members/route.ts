import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonWithSchema, parseQueryWithSchema, withTenantContext } from '@/lib/big4-http';
import {
  listOrganizationMembers,
  removeOrganizationMember,
  setOrganizationMemberRole,
} from '@/lib/control-plane-store';
import type { ApiResponse, TenantMemberResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  org_id: z.string().min(1),
});

const postSchema = z.object({
  action: z.enum(['remove', 'change_role']),
  org_id: z.string().min(1),
  subject: z.string().min(1),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
}).strict();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const result = await listOrganizationMembers(ctx.tenant_id, ctx.actor_id, query.org_id);
      const response: ApiResponse<TenantMemberResponse> = {
        v: 1,
        kind: 'tenant.members.list',
        data: { ok: true, members: result.members, seat_count: result.seat_count },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenant.members.list', cache: false },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, postSchema);

      if (body.action === 'remove') {
        await removeOrganizationMember(ctx.tenant_id, ctx.actor_id, body.org_id, body.subject);
        const response: ApiResponse<TenantMemberResponse> = {
          v: 1,
          kind: 'tenant.members.remove',
          data: { ok: true, removed: true },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === 'change_role') {
        if (!body.role) {
          return NextResponse.json(
            { v: 1, kind: 'tenant.members.change_role', data: null, error: { code: 'missing_argument', message: 'role is required when action=change_role.', details: {}, retryable: false } },
            { status: 400 },
          );
        }
        const membership = await setOrganizationMemberRole(ctx.tenant_id, ctx.actor_id, {
          org_id: body.org_id,
          subject: body.subject,
          role: body.role,
        });
        const response: ApiResponse<TenantMemberResponse> = {
          v: 1,
          kind: 'tenant.members.change_role',
          data: { ok: true, membership },
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
    { routeId: 'tenant.members.mutate', idempotency: { required: true } },
  );
}
