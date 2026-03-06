import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import type { ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

interface TenantIsolationResponse {
  ok: boolean;
  tenant_id: string;
  isolation_status: 'enforced' | 'warning' | 'violation';
  quotas: {
    storage: { used_bytes: number; limit_bytes: number; pct: number };
    rate: { current_rpm: number; limit_rpm: number; pct: number };
    spend: { today: number; daily_limit: number; pct: number };
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
        isolation_status: 'enforced',
        quotas: {
          storage: { used_bytes: 524288000, limit_bytes: 10737418240, pct: 4.88 },
          rate: { current_rpm: 23, limit_rpm: 1000, pct: 2.3 },
          spend: { today: 12.50, daily_limit: 100, pct: 12.5 },
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
