import { NextRequest } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { createFoundryRepository } from '@/lib/foundry-repository';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Query parameter schema
const fetchArtifactsQuerySchema = z.object({
  run_id: z.string().min(1),
  artifact_type: z.enum(['dataset', 'report', 'log', 'manifest', 'checkpoint']).optional(),
});

// GET /api/foundry/artifacts - Fetch artifacts
export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const searchParams = request.nextUrl.searchParams;
      const runId = searchParams.get('run_id');
      const artifactType = searchParams.get('artifact_type');

      if (!runId) {
        return Response.json(
          {
            ok: false,
            error: 'Missing required parameter: run_id',
            code: 'missing_parameter',
            trace_id: ctx.trace_id,
          },
          { status: 400 }
        );
      }

      const repo = createFoundryRepository(ctx);

      // Get artifacts for the run
      let artifacts = await repo.listArtifacts(runId);

      // Filter by artifact type if provided
      if (artifactType) {
        artifacts = artifacts.filter((a) => a.artifact_type === artifactType);
      }

      return Response.json(
        {
          ok: true,
          run_id: runId,
          artifacts,
          total: artifacts.length,
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.artifacts.fetch',
      cache: { ttlMs: 60_000, visibility: 'private', staleWhileRevalidateMs: 60_000 },
    }
  );
}

// GET /api/foundry/artifacts/[id] - Get a specific artifact by ID
// This is handled by a separate route file for [id]
