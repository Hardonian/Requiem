// ready-layer/src/app/api/vector/search/route.ts
//
// API route for vector search
//
// POST /api/vector/search
//   Performs vector similarity search on indexed documents
//
// Request body:
// {
//   query: string,           // Search query text
//   index_key?: string,     // Index key to search (default: 'default')
//   limit?: number,         // Max results (default: 10)
//   min_similarity?: number // Min similarity threshold (default: 0.7)
// }
//
// Response:
// {
//   ok: true,
//   results: [
//     {
//       document_id: string,
//       document_title: string | null,
//       document_content: string,
//       document_source_type: string,
//       document_source_id: string | null,
//       document_metadata: Record<string, unknown>,
//       chunk_index: number,
//       similarity: number
//     }
//   ],
//   query: string,
//   total: number,
//   latency_ms: number
// }
//
// Error responses:
// - 400: Missing or invalid parameters
// - 401: Authentication required
// - 503: Vector search not configured

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth, authErrorResponse } from '@/lib/auth';
import {
  vectorSearch,
  generateEmbedding,
  logQuery,
  DEFAULT_VECTOR_SEARCH_CONFIG,
  VectorSearchResult,
} from '@/lib/vector-search';

// Maximum allowed limit to prevent abuse
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

/**
 * Handle POST requests for vector search
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Validate authentication
  const authResult = await validateTenantAuth(req);
  if (!authResult.ok) {
    return authErrorResponse(authResult);
  }

  const tenant = authResult.tenant!;
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await req.json();
    const {
      query,
      index_key = DEFAULT_VECTOR_SEARCH_CONFIG.index_key,
      limit = DEFAULT_LIMIT,
      min_similarity = DEFAULT_VECTOR_SEARCH_CONFIG.min_similarity,
    } = body;

    // Validate required fields
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'missing_query', message: 'Query string is required' },
        { status: 400 }
      );
    }

    // Validate limit
    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding({ text: query });
    const latencyMs = Date.now() - startTime;

    // Perform vector search
    const results = await vectorSearch({
      tenant_id: tenant.tenant_id,
      query_embedding: queryEmbedding,
      index_key,
      limit: safeLimit,
      min_similarity,
    });

    // Log the query for observability
    const returnedDocIds = (results as VectorSearchResult[]).map(r => r.document_id);
    logQuery(
      tenant.tenant_id,
      'system', // Would be extracted from auth in production
      query,
      returnedDocIds,
      latencyMs
    ).catch(() => {/* Ignore logging errors */});

    const totalLatency = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      results,
      query,
      total: results.length,
      latency_ms: totalLatency,
    });
  } catch (err) {
    console.error('[vector-search] Search error:', err);

    // Check for specific error types
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    // Return 503 if vector search is not configured
    if (errorMessage.includes('not configured') || errorMessage.includes('Supabase')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'vector_search_unavailable',
          message: 'Vector search is not configured. Please set up Supabase credentials.'
        },
        { status: 503 }
      );
    }

    // Return 500 for other errors (but not a hard 500)
    return NextResponse.json(
      {
        ok: false,
        error: 'search_failed',
        message: 'An error occurred while searching. Please try again later.'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests (return API documentation)
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
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
  });
}
