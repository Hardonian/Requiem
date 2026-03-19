import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseQueryWithSchema, withTenantContext } from '@/lib/big4-http';
import { validateOrganizationAdmin } from '@/lib/control-plane-store';
import type { ApiResponse, TenantAdminValidationResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  org_id: z.string().min(1),
  minimum_role: z.enum(['admin', 'operator', 'viewer']).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const result = await validateOrganizationAdmin(
        ctx.tenant_id,
        ctx.actor_id,
        query.org_id,
        query.minimum_role ?? 'admin',
      );
      const response: ApiResponse<TenantAdminValidationResponse> = {
        v: 1,
        kind: 'tenant.admin.validate',
        data: { ok: true, ...result },
        error: null,
      };
      return NextResponse.json(response, { status: result.allow ? 200 : 403 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenant.admin.validate', cache: false },
  );
}
