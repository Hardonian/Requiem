import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';

export const dynamic = 'force-dynamic';

const policySchema = z.record(z.string(), z.unknown());

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      return NextResponse.json(
        {
          ok: true,
          data: { total_cost_units: 0, p50: 0, p95: 0, tenant_id: ctx.tenant_id },
          trace_id: ctx.trace_id,
        },
        { status: 200 },
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'spend.summary',
      cache: { ttlMs: 5_000, visibility: 'private', staleWhileRevalidateMs: 5_000 },
    },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const policy = await parseJsonWithSchema(req, policySchema).catch(() => ({}));
      return NextResponse.json(
        { ok: true, updated: true, policy, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id },
        { status: 200 },
      );
    },
    async () => {
      const role = req.headers.get('x-requiem-role') ?? 'viewer';
      return {
        allow: ['admin', 'operator'].includes(role),
        reasons: ['admin role required'],
      };
    },
    {
      routeId: 'spend.policy.update',
      idempotency: { required: false },
    },
  );
}
