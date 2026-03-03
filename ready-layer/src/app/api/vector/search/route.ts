// ready-layer/src/app/api/vector/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseJsonWithSchema } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import {
  vectorSearch,
  generateEmbedding,
  logQuery,
  DEFAULT_VECTOR_SEARCH_CONFIG,
  VectorSearchResult,
} from '@/lib/vector-search';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

const searchSchema = z.object({
  query: z.string().min(1),
  index_key: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
  min_similarity: z.number().min(0).max(1).optional(),
}).passthrough();

export async function POST(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const startTime = Date.now();
      const body = await parseJsonWithSchema(req, searchSchema);

      const indexKey = body.index_key ?? DEFAULT_VECTOR_SEARCH_CONFIG.index_key;
      const safeLimit = body.limit ?? DEFAULT_LIMIT;
      const minSimilarity = body.min_similarity ?? DEFAULT_VECTOR_SEARCH_CONFIG.min_similarity;

      try {
        const queryEmbedding = await generateEmbedding({ text: body.query });
        const results = await vectorSearch({
          tenant_id: ctx.tenant_id,
          query_embedding: queryEmbedding,
          index_key: indexKey,
          limit: safeLimit,
          min_similarity: minSimilarity,
        });

        const returnedDocIds = (results as VectorSearchResult[]).map((result) => result.document_id);
        void logQuery(ctx.tenant_id, ctx.actor_id, body.query, returnedDocIds, Date.now() - startTime).catch(() => {});

        return NextResponse.json(
          {
            ok: true,
            results,
            query: body.query,
            total: results.length,
            latency_ms: Date.now() - startTime,
            trace_id: ctx.trace_id,
          },
          { status: 200 },
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('not configured') || errorMessage.includes('Supabase')) {
          throw new ProblemError(
            503,
            'Vector Search Unavailable',
            'Vector search is not configured. Configure Supabase credentials.',
            { code: 'vector_search_unavailable' },
          );
        }

        throw new ProblemError(502, 'Search Failed', 'Search request failed safely', {
          code: 'search_failed',
        });
      }
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'vector.search',
    },
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async () => {
      return NextResponse.json(
        {
          ok: true,
          message: 'Vector Search API',
          endpoints: {
            POST: {
              path: '/api/vector/search',
              description: 'Perform vector similarity search',
              body: {
                query: 'string (required) - Search query text',
                index_key: 'string (optional) - Index key to search',
                limit: 'number (optional) - Max results, default 10, max 100',
                min_similarity: 'number (optional) - Min similarity threshold, default 0.7',
              },
            },
          },
        },
        { status: 200 },
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      requireAuth: false,
      routeId: 'vector.search.docs',
      cache: { ttlMs: 60_000, visibility: 'public', staleWhileRevalidateMs: 60_000 },
    },
  );
}
