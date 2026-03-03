import { NextRequest } from 'next/server';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';
import { createFoundryRepository } from '@/lib/foundry-repository';
import type { DatasetItem } from '@/types/foundry';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateDatasetBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  labels_enabled: z.boolean().optional(),
  metadata: z.any().optional(),
});

const addItemsBodySchema = z.object({
  items: z
    .array(
      z.object({
        content: z.any(),
        content_type: z.string().optional(),
        metadata: z.any().optional(),
      })
    )
    .min(1)
    .max(100),
});

// GET /api/foundry/datasets/[id] - Get dataset details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  return withTenantContext(
    request,
    async (ctx) => {
      const repo = createFoundryRepository(ctx);
      const dataset = await repo.getDataset(id);

      if (!dataset) {
        return Response.json(
          {
            ok: false,
            error: 'Dataset not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      // Get items if requested via query param
      const includeItems = request.nextUrl.searchParams.get('include_items') === 'true';
      const itemsLimit = parseInt(
        request.nextUrl.searchParams.get('items_limit') ?? '100',
        10
      );

      if (includeItems) {
        const { items } = await repo.listDatasetItems(id, { limit: itemsLimit });
        return Response.json(
          {
            ok: true,
            dataset: {
              ...dataset,
              items,
            },
            trace_id: ctx.trace_id,
          },
          { status: 200 }
        );
      }

      return Response.json(
        {
          ok: true,
          dataset,
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.datasets.get',
      cache: { ttlMs: 30_000, visibility: 'private' },
    }
  );
}

// PATCH /api/foundry/datasets/[id] - Update dataset
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, updateDatasetBodySchema);
      const repo = createFoundryRepository(ctx);

      // Check dataset exists
      const existing = await repo.getDataset(id);
      if (!existing) {
        return Response.json(
          {
            ok: false,
            error: 'Dataset not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      const dataset = await repo.updateDataset(id, {
        name: body.name,
        description: body.description,
        labels_enabled: body.labels_enabled,
        metadata: body.metadata,
      });

      return Response.json(
        {
          ok: true,
          dataset,
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.datasets.update',
    }
  );
}

// DELETE /api/foundry/datasets/[id] - Delete dataset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  return withTenantContext(
    request,
    async (ctx) => {
      const repo = createFoundryRepository(ctx);

      // Check dataset exists
      const existing = await repo.getDataset(id);
      if (!existing) {
        return Response.json(
          {
            ok: false,
            error: 'Dataset not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      await repo.deleteDataset(id);

      return Response.json(
        {
          ok: true,
          message: 'Dataset deleted successfully',
          trace_id: ctx.trace_id,
        },
        { status: 200 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.datasets.delete',
    }
  );
}

// POST /api/foundry/datasets/[id]/items - Add items to dataset
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, addItemsBodySchema);
      const repo = createFoundryRepository(ctx);

      // Check dataset exists
      const dataset = await repo.getDataset(id);
      if (!dataset) {
        return Response.json(
          {
            ok: false,
            error: 'Dataset not found',
            trace_id: ctx.trace_id,
          },
          { status: 404 }
        );
      }

      // Get current item count for indexing
      const { total } = await repo.listDatasetItems(id, { limit: 1 });
      let nextIndex = total;

      // Add items
      const addedItems: DatasetItem[] = [];
      for (const item of body.items) {
        const added = await repo.addDatasetItem({
          dataset_id: id,
          item_index: nextIndex++,
          content: item.content,
          content_type: item.content_type,
          metadata: item.metadata,
        });
        addedItems.push(added);
      }

      return Response.json(
        {
          ok: true,
          items_added: addedItems.length,
          items: addedItems,
          trace_id: ctx.trace_id,
        },
        { status: 201 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.datasets.addItems',
      idempotency: { required: false, ttlMs: 24 * 60 * 60 * 1000 },
    }
  );
}
