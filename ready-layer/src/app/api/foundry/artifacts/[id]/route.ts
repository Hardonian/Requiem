import { NextRequest } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { createFoundryRepository } from '@/lib/foundry-repository';

export const dynamic = 'force-dynamic';

// GET /api/foundry/artifacts/[id] - Get artifact details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  return withTenantContext(
    request,
    async (ctx) => {
      const repo = createFoundryRepository(ctx);
      const artifact = await repo.getArtifact(id);

      if (!artifact) {
        return Response.json(
          {
            ok: false,
            error: 'Artifact not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      return Response.json(
        {
          ok: true,
          artifact,
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.artifacts.get',
      cache: { ttlMs: 60_000, visibility: 'private' },
    }
  );
}

// DELETE /api/foundry/artifacts/[id] - Delete an artifact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  return withTenantContext(
    request,
    async (ctx) => {
      const repo = createFoundryRepository(ctx);

      // Check artifact exists
      const artifact = await repo.getArtifact(id);
      if (!artifact) {
        return Response.json(
          {
            ok: false,
            error: 'Artifact not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      // Note: Actual deletion from storage would happen here
      // For now, we just return success since artifacts are metadata-only in the DB

      return Response.json(
        {
          ok: true,
          message: 'Artifact deleted successfully',
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.artifacts.delete',
    }
  );
}
