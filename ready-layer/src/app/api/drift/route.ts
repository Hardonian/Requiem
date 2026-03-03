import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';

export const dynamic = 'force-dynamic';

const driftVectorSchema = z.record(z.string(), z.unknown());

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      return NextResponse.json(
        { ok: true, data: { vectors: [], latest_status: 'stable' }, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id },
        { status: 200 },
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'drift.list',
      cache: { ttlMs: 15_000, visibility: 'private', staleWhileRevalidateMs: 15_000 },
    },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const vector = await parseJsonWithSchema(req, driftVectorSchema).catch(() => ({}));
      return NextResponse.json(
        { ok: true, created: true, vector, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id },
        { status: 201 },
      );
    },
    async (ctx) => ({
      allow: ctx.actor_id !== 'anonymous',
      reasons: ctx.actor_id === 'anonymous' ? ['actor identity required'] : [],
    }),
    {
      routeId: 'drift.create',
      idempotency: { required: false },
    },
  );
}
