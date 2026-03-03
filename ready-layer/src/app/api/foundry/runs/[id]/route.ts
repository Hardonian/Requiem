import { NextRequest } from 'next/server';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';
import { createFoundryRepository } from '@/lib/foundry-repository';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateRunBodySchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  output_dataset_id: z.string().uuid().optional(),
  item_count: z.number().int().min(0).optional(),
  duration_ms: z.number().int().min(0).optional(),
  error_message: z.string().optional(),
  error_code: z.string().optional(),
  metadata: z.any().optional(),
});

const createArtifactBodySchema = z.object({
  artifact_type: z.enum(['dataset', 'report', 'log', 'manifest', 'checkpoint']),
  artifact_name: z.string().min(1).max(200),
  content_hash: z.string().min(1),
  storage_path: z.string().min(1),
  size_bytes: z.number().int().min(0),
  mime_type: z.string().optional(),
  metadata: z.any().optional(),
});

// GET /api/foundry/runs/[id] - Get run details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  return withTenantContext(
    request,
    async (ctx) => {
      const repo = createFoundryRepository(ctx);
      const run = await repo.getGeneratorRun(id);

      if (!run) {
        return Response.json(
          {
            ok: false,
            error: 'Generator run not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      // Get artifacts if requested
      const includeArtifacts = request.nextUrl.searchParams.get('include_artifacts') === 'true';

      if (includeArtifacts) {
        const artifacts = await repo.listArtifacts(id);
        return Response.json(
          {
            ok: true,
            run: {
              ...run,
              artifacts,
            },
            trace_id: ctx.trace_id,
          },
          { status: 200 }
        );
      }

      return Response.json(
        {
          ok: true,
          run,
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.runs.get',
      cache: { ttlMs: 10_000, visibility: 'private' },
    }
  );
}

// PATCH /api/foundry/runs/[id] - Update run status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, updateRunBodySchema);
      const repo = createFoundryRepository(ctx);

      // Check run exists
      const existing = await repo.getGeneratorRun(id);
      if (!existing) {
        return Response.json(
          {
            ok: false,
            error: 'Generator run not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      const run = await repo.updateGeneratorRun(id, {
        status: body.status,
        output_dataset_id: body.output_dataset_id,
        item_count: body.item_count,
        duration_ms: body.duration_ms,
        error_message: body.error_message,
        error_code: body.error_code,
        metadata: body.metadata,
      });

      return Response.json(
        {
          ok: true,
          run,
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.runs.update',
    }
  );
}

// POST /api/foundry/runs/[id]/artifacts - Create artifact for run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, createArtifactBodySchema);
      const repo = createFoundryRepository(ctx);

      // Check run exists
      const run = await repo.getGeneratorRun(id);
      if (!run) {
        return Response.json(
          {
            ok: false,
            error: 'Generator run not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      const artifact = await repo.createArtifact({
        run_id: id,
        run_type: 'generator_run',
        artifact_type: body.artifact_type,
        artifact_name: body.artifact_name,
        content_hash: body.content_hash,
        storage_path: body.storage_path,
        size_bytes: body.size_bytes,
        mime_type: body.mime_type,
        metadata: body.metadata,
      });

      return Response.json(
        {
          ok: true,
          artifact,
          trace_id: ctx.trace_id,
        },
        { status: 201 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.runs.createArtifact',
      idempotency: { required: false, ttlMs: 24 * 60 * 60 * 1000 },
    }
  );
}
