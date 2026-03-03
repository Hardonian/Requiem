import { NextRequest } from 'next/server';
import { withTenantContext, parseJsonWithSchema, parseQueryWithSchema } from '@/lib/big4-http';
import { createFoundryRepository } from '@/lib/foundry-repository';
import {
  generateSeededSampleDataset,
  prepareSeededDatasetForInsertion,
} from '@/lib/foundry-seed-generator';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schemas
const listDatasetsQuerySchema = z.object({
  dataset_type: z.enum(['test', 'train', 'validation', 'benchmark']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const createDatasetBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dataset_type: z.enum(['test', 'train', 'validation', 'benchmark']).optional(),
  schema_json: z.any().optional(),
  labels_enabled: z.boolean().optional(),
  metadata: z.any().optional(),
});

const createSampleDatasetBodySchema = z.object({
  seed: z.number().int().min(0).max(2147483647).default(12345),
  item_count: z.number().int().min(1).max(10000).default(100),
  schema: z.enum(['simple', 'complex', 'edge_cases']).default('simple'),
  include_labels: z.boolean().default(true),
  label_distribution: z.record(z.string(), z.number()).optional(),
});

// GET /api/foundry/datasets - List datasets
export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = await parseQueryWithSchema(request, listDatasetsQuerySchema);
      const repo = createFoundryRepository(ctx);

      const { datasets, total } = await repo.listDatasets({
        dataset_type: query.dataset_type,
        limit: query.limit,
        offset: query.offset,
      });

      return Response.json(
        {
          ok: true,
          datasets,
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
      routeId: 'foundry.datasets.list',
      cache: { ttlMs: 30_000, visibility: 'private', staleWhileRevalidateMs: 30_000 },
    }
  );
}

// POST /api/foundry/datasets - Create a new dataset
export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      // Check if this is a sample dataset request
      const contentType = request.headers.get('content-type') ?? '';
      const rawBody = await request.clone().json();

      // If the body has 'seed', treat it as a sample dataset request
      if ('seed' in rawBody) {
        const body = await parseJsonWithSchema(request, createSampleDatasetBodySchema);
        const repo = createFoundryRepository(ctx);

        // Generate deterministic sample dataset
        const sample = generateSeededSampleDataset({
          tenant_id: ctx.tenant_id,
          actor_id: ctx.actor_id,
          trace_id: ctx.trace_id,
          config: {
            seed: body.seed,
            item_count: body.item_count,
            schema: body.schema,
            include_labels: body.include_labels,
            label_distribution: body.label_distribution,
          },
        });

        // Prepare for insertion with proper IDs
        const { dataset, items, labels } = prepareSeededDatasetForInsertion(
          sample,
          ctx.tenant_id
        );

        // Insert dataset
        const createdDataset = await repo.createDataset({
          name: dataset.name,
          description: dataset.description,
          dataset_type: dataset.dataset_type,
          schema_json: dataset.schema_json ?? undefined,
          labels_enabled: dataset.labels_enabled,
          metadata: dataset.metadata ?? undefined,
        });

        // Insert items in batches
        const batchSize = 100;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          await Promise.all(
            batch.map((item) =>
              repo.addDatasetItem({
                dataset_id: createdDataset.id,
                item_index: item.item_index,
                content: item.content,
                content_type: item.content_type,
                metadata: item.metadata ?? undefined,
              })
            )
          );
        }

        // Insert labels
        if (labels.length > 0) {
          await Promise.all(
            labels.map((label) =>
              repo.createLabel({
                dataset_id: createdDataset.id,
                dataset_item_id: label.dataset_item_id,
                label_type: label.label_type,
                label_key: label.label_key,
                label_value: label.label_value,
                confidence: label.confidence,
                source_generator_id: label.source_generator_id,
                metadata: label.metadata ?? undefined,
              })
            )
          );
        }

        return Response.json(
          {
            ok: true,
            dataset: createdDataset,
            item_count: items.length,
            label_count: labels.length,
            seed: body.seed,
            trace_id: ctx.trace_id,
          },
          { status: 201 }
        );
      }

      // Regular dataset creation
      const body = await parseJsonWithSchema(request, createDatasetBodySchema);
      const repo = createFoundryRepository(ctx);

      const dataset = await repo.createDataset({
        name: body.name,
        description: body.description,
        dataset_type: body.dataset_type,
        schema_json: body.schema_json,
        labels_enabled: body.labels_enabled,
        metadata: body.metadata,
      });

      return Response.json(
        {
          ok: true,
          dataset,
          trace_id: ctx.trace_id,
        },
        { status: 201 }
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'foundry.datasets.create',
      idempotency: { required: false, ttlMs: 24 * 60 * 60 * 1000 },
    }
  );
}
