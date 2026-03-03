import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';

export const dynamic = 'force-dynamic';

const publishSchema = z.record(z.string(), z.unknown());

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const q = new URL(req.url).searchParams.get('q') ?? '';
      return NextResponse.json(
        { ok: true, data: [], query: q, tenant_id: ctx.tenant_id, trace_id: ctx.trace_id },
        { status: 200 },
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'registry.search',
      cache: { ttlMs: 15_000, visibility: 'private', staleWhileRevalidateMs: 15_000 },
    },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const body = await parseJsonWithSchema(req, publishSchema).catch(() => ({}));
      return NextResponse.json(
        {
          ok: true,
          published: false,
          reason: 'registry_publish_scaffold',
          body,
          tenant_id: ctx.tenant_id,
          trace_id: ctx.trace_id,
        },
        { status: 202 },
      );
    },
    async (ctx) => ({
      allow: ctx.actor_id !== 'anonymous',
      reasons: ctx.actor_id === 'anonymous' ? ['actor identity required'] : [],
    }),
    {
      routeId: 'registry.publish',
      idempotency: { required: false },
    },
  );
}
