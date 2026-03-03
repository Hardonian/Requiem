import { NextRequest } from 'next/server';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';
import { createFoundryRepository } from '@/lib/foundry-repository';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schemas
const createGeneratorBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  generator_type: z.enum(['synthetic', 'augment', 'mutate', 'sample']),
  config_json: z.any(),
  seed_value: z.number().int().optional(),
  deterministic: z.boolean().optional().default(true),
  metadata: z.any().optional(),
});

// GET /api/foundry/generators - List generators
export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const repo = createFoundryRepository(ctx);

      // For now, return a simple list (could add pagination later)
      // Since we don't have a listGenerators method in repo, we'll use raw query or return empty
      return Response.json(
        {
          ok: true,
          generators: [],
          total: 0,
          page: 1,
          page_size: 50,
          has_more: false,
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.generators.list',
      cache: { ttlMs: 30_000, visibility: 'private', staleWhileRevalidateMs: 30_000 },
    }
  );
}

// POST /api/foundry/generators - Create a new generator
export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, createGeneratorBodySchema);
      const repo = createFoundryRepository(ctx);

      const generator = await repo.createGenerator({
        name: body.name,
        description: body.description,
        generator_type: body.generator_type,
        config_json: body.config_json,
        seed_value: body.seed_value,
        deterministic: body.deterministic,
        metadata: body.metadata,
      });

      return Response.json(
        {
          ok: true,
          generator,
          trace_id: ctx.trace_id,
        },
        { status: 201 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.generators.create',
      idempotency: { required: false, ttlMs: 24 * 60 * 60 * 1000 },
    }
  );
}
