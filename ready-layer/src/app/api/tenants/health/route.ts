import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { getTenantOrganizationsHealth } from '@/lib/control-plane-store';
import type { ApiResponse, TenantHealthResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const organizations = await getTenantOrganizationsHealth(ctx.tenant_id, ctx.actor_id);
      const response: ApiResponse<TenantHealthResponse> = {
        v: 1,
        kind: 'tenant.health',
        data: {
          ok: true,
          tenant_id: ctx.tenant_id,
          organizations,
          totals: {
            organizations: organizations.length,
            running_jobs: organizations.reduce((sum, item) => sum + item.jobs_running, 0),
            pending_jobs: organizations.reduce((sum, item) => sum + item.queue_depth, 0),
            failed_jobs: organizations.filter((item) => item.last_error_code).length,
          },
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenant.health', cache: false },
  );
}
