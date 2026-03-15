import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import type { ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

interface TenantIsolationResponse {
  ok: boolean;
  tenant_id: string;
  isolation_status: 'enforced' | 'warning' | 'violation';
  source: 'stub';
  configured: boolean;
  quotas: {
    storage: { used_bytes: number | null; limit_bytes: number | null; pct: number | null };
    rate: { current_rpm: number | null; limit_rpm: number | null; pct: number | null };
    spend: { today: number | null; daily_limit: number | null; pct: number | null };
  };
  violations: Array<{
    violation_id: string;
    timestamp: string;
    target_tenant: string;
    resource_type: string;
    blocked: boolean;
  }>;
  scoped_paths: {
    cas: string;
    events: string;
    audit: string;
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const result: TenantIsolationResponse = {
        ok: true,
        tenant_id: ctx.tenant_id,
        source: 'stub',
        configured: Boolean(process.env.REQUIEM_API_URL),
        isolation_status: 'enforced',
        quotas: {
          storage: { used_bytes: null, limit_bytes: null, pct: null },
          rate: { current_rpm: null, limit_rpm: null, pct: null },
          spend: { today: null, daily_limit: null, pct: null },
        },
        violations: [],
        scoped_paths: {
          cas: `/data/tenants/${ctx.tenant_id}/cas`,
          events: `/data/tenants/${ctx.tenant_id}/events`,
          audit: `/data/tenants/${ctx.tenant_id}/audit`,
        },
      };

      const response: ApiResponse<TenantIsolationResponse> = {
        v: 1,
        kind: 'tenants.isolation',
        data: result,
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'tenants.isolation' },
  );
}
