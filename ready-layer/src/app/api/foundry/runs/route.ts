import { NextRequest } from 'next/server';
import { withTenantContext, parseJsonWithSchema, parseQueryWithSchema } from '@/lib/big4-http';
import { createFoundryRepository } from '@/lib/foundry-repository';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schemas
const listRunsQuerySchema = z.object({
  generator_id: z.string().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const runGeneratorBodySchema = z.object({
  generator_id: z.string().uuid(),
  source_dataset_id: z.string().uuid().optional(),
  seed_value: z.number().int().optional(),
  item_count: z.number().int().min(1).max(10000).optional(),
  config_override: z.any().optional(),
});

// GET /api/foundry/runs - List generator runs
export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = await parseQueryWithSchema(request, listRunsQuerySchema);
      const repo = createFoundryRepository(ctx);

      const { runs, total } = await repo.listGeneratorRuns({
        generator_id: query.generator_id,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });

      return Response.json(
        {
          ok: true,
          runs,
          total,
          page: Math.floor(query.offset / query.limit) + 1,
          page_size: query.limit,
          has_more: query.offset + query.limit < total,
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.runs.list',
      cache: { ttlMs: 10_000, visibility: 'private', staleWhileRevalidateMs: 10_000 },
    }
  );
}

// POST /api/foundry/runs - Run a generator
export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, runGeneratorBodySchema);
      const repo = createFoundryRepository(ctx);

      // Validate generator exists
      const generator = await repo.getGenerator(body.generator_id);
      if (!generator) {
        return Response.json(
          {
            ok: false,
            error: 'Generator not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      // Validate source dataset if provided
      if (body.source_dataset_id) {
        const dataset = await repo.getDataset(body.source_dataset_id);
        if (!dataset) {
          return Response.json(
            {
              ok: false,
              error: 'Source dataset not found',
              trace_id: ctx.trace_id,
            },
            { status: 404 }
          );
        }
      }

      // Create the generator run
      const run = await repo.createGeneratorRun({
        generator_id: body.generator_id,
        source_dataset_id: body.source_dataset_id,
        config_snapshot: body.config_override,
        seed_value: body.seed_value,
      });

      // Start the run (in production, this would trigger a background job)
      await repo.updateGeneratorRun(run.run_id, {
        status: 'running',
      });

      return Response.json(
        {
          ok: true,
          run,
          message: 'Generator run started',
          trace_id: ctx.trace_id,
        },
        { status: 201 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.runs.create',
      idempotency: { required: false, ttlMs: 24 * 60 * 60 * 1000 },
    }
  );
}
