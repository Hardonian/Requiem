import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonWithSchema, withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import {
  createOrganization,
  deleteOrganization,
  listOrganizations,
  removeOrganizationMember,
  setOrganizationMemberRole,
  updateOrganization,
} from '@/lib/control-plane-store';
import type {
  ApiResponse,
  TenantOrganizationMutationResponse,
  TenantOrganizationsListResponse,
} from '@/types/engine';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'set_member_role', 'remove_member']),
  org_id: z.string().min(1),
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'paused', 'degraded']).optional(),
  plan: z.enum(['free', 'growth', 'enterprise']).optional(),
  budget_cents: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  subject: z.string().min(1).optional(),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
}).strict();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const result = await listOrganizations(ctx.tenant_id, ctx.actor_id);
      const response: ApiResponse<TenantOrganizationsListResponse> = {
        v: 1,
        kind: 'tenant.organizations.list',
        data: {
          ok: true,
          organizations: result.organizations,
          memberships: result.memberships,
          total: result.organizations.length,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenant.organizations.list', cache: false },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, postSchema);

      if (body.action === 'create') {
        if (!body.name) {
          throw new ProblemError(400, 'Missing Argument', 'name is required when action=create.', { code: 'missing_argument' });
        }
        const result = await createOrganization(ctx.tenant_id, ctx.actor_id, {
          org_id: body.org_id,
          name: body.name,
          plan: body.plan,
          budget_cents: body.budget_cents,
          metadata: body.metadata,
        });
        const response: ApiResponse<TenantOrganizationMutationResponse> = {
          v: 1,
          kind: 'tenant.organizations.create',
          data: { ok: true, organization: result.organization, membership: result.membership },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === 'update') {
        const organization = await updateOrganization(ctx.tenant_id, ctx.actor_id, {
          org_id: body.org_id,
          name: body.name,
          status: body.status,
          plan: body.plan,
          budget_cents: body.budget_cents,
          metadata: body.metadata,
        });
        const response: ApiResponse<TenantOrganizationMutationResponse> = {
          v: 1,
          kind: 'tenant.organizations.update',
          data: { ok: true, organization },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === 'delete') {
        await deleteOrganization(ctx.tenant_id, ctx.actor_id, body.org_id);
        const response: ApiResponse<TenantOrganizationMutationResponse> = {
          v: 1,
          kind: 'tenant.organizations.delete',
          data: { ok: true, deleted: true },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === 'remove_member') {
        if (!body.subject) {
          throw new ProblemError(400, 'Missing Argument', 'subject is required when action=remove_member.', { code: 'missing_argument' });
        }
        await removeOrganizationMember(ctx.tenant_id, ctx.actor_id, body.org_id, body.subject);
        const response: ApiResponse<TenantOrganizationMutationResponse> = {
          v: 1,
          kind: 'tenant.organizations.member.remove',
          data: { ok: true, deleted: true },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (!body.subject || !body.role) {
        throw new ProblemError(400, 'Missing Argument', 'subject and role are required when action=set_member_role.', { code: 'missing_argument' });
      }

      const membership = await setOrganizationMemberRole(ctx.tenant_id, ctx.actor_id, {
        org_id: body.org_id,
        subject: body.subject,
        role: body.role,
      });
      const response: ApiResponse<TenantOrganizationMutationResponse> = {
        v: 1,
        kind: 'tenant.organizations.member.set_role',
        data: { ok: true, membership },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenant.organizations.mutate', idempotency: { required: true } },
  );
}
